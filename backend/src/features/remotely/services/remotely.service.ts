import axios, { type AxiosInstance } from 'axios';
import crypto from 'node:crypto';
import type { OperatingSystem } from '@prisma/client';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { logger } from '../../../shared/utils/logger.js';
import { deviceRepository, type DeviceStatus } from '../../devices/index.js';
import { platformSettingsService } from '../../settings/index.js';
import { companyRepository } from '../../companies/index.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CacheKeys, CachePatterns } from '../../../shared/cache/cache-keys.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { env } from '../../../config/env.js';
import { buildLinuxInstallCommand, buildWindowsBatContent, buildWindowsInstallCommand } from '../scripts/agent-deploy.util.js';
import type {
  AgentScriptInfo,
  DeviceTelemetry,
  ExecuteScriptInput,
  ExecuteScriptResult,
  RemoteSessionHistoryEntry,
  RemotelyDevice,
  RemotelyDeviceGroup,
  RemotelyScriptResultRaw,
  ScriptShell,
  StartSessionInput,
  StartSessionResult,
} from '../types/remotely.types.js';

const DEVICE_STATUS_CACHE_TTL = 60;
const DEVICE_TELEMETRY_CACHE_TTL = 60;
// El link público de instalador (ver createInstallerLink/resolveInstallerToken)
// vence a las 24h — tiempo de sobra para que un contacto externo lo abra
// desde el chat, sin quedar utilizable indefinidamente.
const INSTALLER_LINK_TTL = 24 * 60 * 60;
// Los grupos de Remotely los administra el usuario a mano desde Remotely
// mismo — no cambian cada pocos segundos como el status, así que un TTL más
// largo evita pegarle a /api/OrganizationManagement/DeviceGroup en cada
// ciclo del poller (cada 5s).
const DEVICE_GROUPS_CACHE_TTL = 300;
// El organizationId no cambia nunca para una cuenta de Remotely dada.
const ORGANIZATION_ID_CACHE_TTL = 3600;

// Mapeo a los shells reales que espera Remotely (ver ScriptingController):
// PSCore | WinPS | Bash | CMD. 'powershell' asume PowerShell de Windows
// clásico (WinPS) — cambiar a 'PSCore' si tus agentes corren PowerShell Core.
const SHELL_MODE: Record<ScriptShell, string> = {
  powershell: 'WinPS',
  bash: 'Bash',
  cmd: 'CMD',
};

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, i) => value === sortedB[i]);
}

// Remotely reporta "platform" como string libre ("Windows" confirmado en
// vivo) — se mapea de forma laxa (includes, no ===) por si viene con
// variantes tipo "Windows 10" o "Mac OS".
function mapPlatformToOS(platform: string | null): OperatingSystem | undefined {
  if (!platform) return undefined;
  const p = platform.toLowerCase();
  if (p.includes('windows')) return 'Windows';
  if (p.includes('linux')) return 'Linux';
  if (p.includes('mac')) return 'MacOS';
  return undefined;
}

// Cliente HTTP contra la API de Remotely (https://github.com/immense/Remotely).
// Auth confirmada contra el código fuente del server: header `X-Api-Key` con
// valor "keyId:secret" (el API key que Remotely entrega al crearlo en Account
// → API Access ya viene en ese formato — no es un bearer token). El
// organizationId NO se manda: Remotely lo resuelve del propio API key.
//
// La config (server URL, API key) NO se lee una sola vez en el constructor:
// se resuelve en cada llamada vía platformSettingsService, que prioriza lo
// guardado en Configuración (BD) y cae a las env vars si no hay nada guardado.
export class RemotelyService {
  private async getClient(): Promise<AxiosInstance> {
    const config = await platformSettingsService.getEffectiveConfig();

    return axios.create({
      baseURL: config.serverUrl,
      headers: {
        'X-Api-Key': config.apiKey,
      },
      timeout: 20_000,
    });
  }

  async listDevices(): Promise<RemotelyDevice[]> {
    const client = await this.getClient();
    try {
      const { data } = await client.get<RemotelyDevice[]>('/api/devices');
      return data;
    } catch (err) {
      this.handleError(err, 'No se pudo obtener la lista de dispositivos de Remotely');
    }
  }

  // GET /api/OrganizationManagement/DeviceGroup (confirmado en vivo contra el
  // servidor real: mismo filtro X-Api-Key que /api/devices). El listado de
  // devices solo trae el deviceGroupID (el objeto anidado deviceGroup viene
  // null ahí), así que el nombre se resuelve aparte con esto.
  async listDeviceGroups(): Promise<RemotelyDeviceGroup[]> {
    const client = await this.getClient();
    try {
      const { data } = await client.get<RemotelyDeviceGroup[]>('/api/OrganizationManagement/DeviceGroup');
      return data;
    } catch (err) {
      this.handleError(err, 'No se pudo obtener los grupos de dispositivos de Remotely');
    }
  }

  // El organizationId de Remotely no se manda nunca en nuestras llamadas (se
  // resuelve del propio API key del lado del server), pero SÍ lo necesitamos
  // para armar los comandos de instalación de agente (ver
  // scripts/agent-deploy.util.ts) — esa ruta es pública y necesita el
  // organizationId real en la URL. Se deriva del primer grupo/device que
  // devuelva la API (ambos lo traen) en vez de pedirle al admin que lo cargue
  // a mano — un valor que no cambia nunca para una cuenta, TTL largo.
  async getOrganizationId(): Promise<string> {
    const cached = await cacheService.get<string>(CacheKeys.remotelyOrganizationId);
    if (cached) return cached;

    const groups = await this.listDeviceGroups();
    let organizationId = groups.find((g) => g.organizationID)?.organizationID;

    if (!organizationId) {
      const devices = await this.listDevices();
      organizationId = devices.find((d) => d.organizationID)?.organizationID;
    }

    if (!organizationId) {
      throw new AppError(
        'No se pudo determinar el organizationId de Remotely — hace falta al menos un grupo o dispositivo existente en tu cuenta de Remotely.',
        422,
      );
    }

    await cacheService.set(CacheKeys.remotelyOrganizationId, organizationId, ORGANIZATION_ID_CACHE_TTL);
    return organizationId;
  }

  // Mapa id → nombre de grupo, cacheado (TTL 5 min) para no pedirlo de nuevo
  // en cada ciclo del poller de status (cada 5s). Público: lo usa también
  // RemotelyController.agentScript para resolver el nombre del grupo de una
  // empresa.
  async getDeviceGroupMap(): Promise<Map<string, string>> {
    const cached = await cacheService.get<Record<string, string>>(CacheKeys.remotelyDeviceGroups);
    if (cached) return new Map(Object.entries(cached));

    const groups = await this.listDeviceGroups();
    const asRecord = Object.fromEntries(groups.map((g) => [g.id, g.name]));
    await cacheService.set(CacheKeys.remotelyDeviceGroups, asRecord, DEVICE_GROUPS_CACHE_TTL);
    return new Map(Object.entries(asRecord));
  }

  // Arma toda la info de instalación del agente para una empresa (comandos +
  // .bat con endurecimiento embebido, ver scripts/agent-deploy.util.ts) —
  // usado tanto por la ruta autenticada de "Agentes" (RemotelyController.agentScript,
  // requireGroup:true — ahí es un admin gestionando una empresa conocida,
  // vale la pena pedirle que la mapee primero) como por el link temporal
  // enviado desde una conversación (conversationService.sendAgentInstallerLink,
  // requireGroup:false — puede ser una empresa recién autogenerada por NIT/
  // WhatsApp, o directamente soporte a un usuario particular sin empresa de
  // por medio; el instalador funciona igual, solo queda sin grupo asignado
  // en Remotely hasta que alguien lo organice a mano).
  async buildAgentScriptInfo(companyId: string, opts: { requireGroup?: boolean } = {}): Promise<AgentScriptInfo> {
    const requireGroup = opts.requireGroup ?? true;

    // companyRepository directo (no companyService.getById) a propósito: ese
    // asume un llamador autenticado y aplica scoping por empresa — acá se
    // usa también desde la ruta pública del link temporal (sin usuario), que
    // ya está autorizada por el token; la ruta autenticada de "Agentes" es
    // admin-only a nivel de router, así que tampoco necesita ese chequeo.
    const company = await companyRepository.findById(companyId);
    if (!company) throw new NotFoundError('Empresa');
    if (requireGroup && !company.remotelyGroupId) {
      throw new AppError('Esta empresa no tiene un grupo de Remotely mapeado — configuralo en Empresas.', 422);
    }

    const [{ remotelyServerUrl }, organizationId, groupMap] = await Promise.all([
      platformSettingsService.getPublic(),
      this.getOrganizationId(),
      this.getDeviceGroupMap(),
    ]);
    if (!remotelyServerUrl) {
      throw new AppError('No hay un servidor de Remotely configurado — configuralo en Configuración.', 422);
    }

    const groupName = company.remotelyGroupId
      ? (groupMap.get(company.remotelyGroupId) ?? company.remotelyGroupId)
      : undefined;
    const windowsCommand = buildWindowsInstallCommand(remotelyServerUrl, organizationId, groupName);
    // Si no está configurada API_PUBLIC_URL, buildWindowsBatContent igual
    // aplica el endurecimiento — solo omite el paso de reportarlo de vuelta
    // (ver harden-agent.script.ts / env.apiPublicUrl).
    const hardenReportUrl = env.apiPublicUrl
      ? `${env.apiPublicUrl.replace(/\/+$/, '')}/api/public/remotely/harden-report`
      : null;

    return {
      companyId: company.id,
      companyName: company.nombre,
      groupName: groupName ?? null,
      windows: {
        command: windowsCommand,
        batContent: buildWindowsBatContent(windowsCommand, company.id, hardenReportUrl),
      },
      linux: {
        ubuntu: buildLinuxInstallCommand(remotelyServerUrl, organizationId, 'UbuntuInstaller-x64'),
        manjaro: buildLinuxInstallCommand(remotelyServerUrl, organizationId, 'ManjaroInstaller-x64'),
      },
    };
  }

  // Link público temporal para que un contacto EXTERNO (sin cuenta) se baje
  // el instalador de su empresa desde el chat — ver
  // conversationService.sendAgentInstallerLink y remotely-public.controller.ts.
  // Token opaco en Redis en vez de una tabla nueva: mismo criterio que
  // cualquier otro valor de corta vida que ya vive en cache (ver rate-limiter.ts).
  async createInstallerLink(companyId: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    await cacheService.set(`agent-installer-token:${token}`, companyId, INSTALLER_LINK_TTL);
    return token;
  }

  async resolveInstallerToken(token: string): Promise<string | null> {
    return cacheService.get<string>(`agent-installer-token:${token}`);
  }

  // Mapa deviceGroupID de Remotely → id de Company nuestra (Company.remotelyGroupId,
  // configurado en Configuración → Empresas). Cacheado (TTL 5 min, igual que
  // getDeviceGroupMap) porque el mapeo lo administra un admin a mano, no
  // cambia cada 5s.
  private async getCompanyByGroupMap(): Promise<Map<string, string>> {
    const cached = await cacheService.get<Record<string, string>>(CacheKeys.companiesByRemotelyGroup);
    if (cached) return new Map(Object.entries(cached));

    const companies = await companyRepository.findAllMappedToRemotelyGroup();
    const asRecord = Object.fromEntries(
      companies.filter((c) => c.remotelyGroupId).map((c) => [c.remotelyGroupId as string, c.id]),
    );
    await cacheService.set(CacheKeys.companiesByRemotelyGroup, asRecord, DEVICE_GROUPS_CACHE_TTL);
    return new Map(Object.entries(asRecord));
  }

  // Sondea Remotely (llamado cada 5s — ver shared/services/device-status-updater.service.ts).
  // Por cada device de Remotely:
  // - si NO existe localmente y su grupo mapea a una empresa (Configuración →
  //   Empresas), lo da de alta automáticamente bajo esa empresa — así el
  //   inventario se completa solo en vez de requerir registro manual. Si el
  //   grupo no tiene empresa mapeada, se ignora (como antes) hasta que se
  //   mapee; se recogerá en un ciclo posterior. El resto de sus datos (status,
  //   telemetría) se completa en el ciclo SIGUIENTE (este ciclo solo lo crea),
  //   para no duplicar toda la lógica de abajo en el mismo pase.
  // - si YA existe, persiste en Postgres lo durable/de baja frecuencia
  //   (estado, último contacto, versión del agente, y la empresa si el mapeo
  //   de su grupo cambió — ver empresaChanged);
  // - cachea en Redis lo que cambia todo el tiempo (TTL 60s): status
  //   individual (device:{id}:status) y telemetría (device:{id}:telemetry —
  //   CPU/RAM/disco/drives). Meter esto último en Postgres implicaría un
  //   UPDATE por dispositivo cada 5s solo para datos que quedan viejos al
  //   instante — Redis con TTL corto es el lugar correcto.
  // - emite device.status.changed cuando el estado cambia respecto al último
  //   valor cacheado.
  async updateDeviceStatusCache(): Promise<void> {
    const remoteDevices = await this.listDevices();
    const groupMap = await this.getDeviceGroupMap();
    const companyByGroup = await this.getCompanyByGroupMap();
    const touchedCompanies = new Set<string>();

    for (const remoteDevice of remoteDevices) {
      const mappedCompanyId = remoteDevice.deviceGroupID ? companyByGroup.get(remoteDevice.deviceGroupID) : undefined;
      const localDevice = await deviceRepository.findByRemotelyId(remoteDevice.id);

      if (!localDevice) {
        if (!mappedCompanyId) continue; // sin empresa mapeada para su grupo: no se da de alta todavía

        const groupName = remoteDevice.deviceGroupID ? (groupMap.get(remoteDevice.deviceGroupID) ?? null) : null;
        await deviceRepository.create({
          nombre: remoteDevice.alias || remoteDevice.deviceName || 'Equipo sin nombre',
          hostname: remoteDevice.deviceName ?? undefined,
          empresa: { connect: { id: mappedCompanyId } },
          remotelyId: remoteDevice.id,
          so: mapPlatformToOS(remoteDevice.platform),
          versionSo: remoteDevice.osDescription ?? undefined,
          cpuCores: remoteDevice.processorCount || undefined,
          ramGb: remoteDevice.totalMemory ? Math.round(remoteDevice.totalMemory) : undefined,
          discoGb: remoteDevice.totalStorage ? Math.round(remoteDevice.totalStorage) : undefined,
          agentVersion: remoteDevice.agentVersion ?? undefined,
          macAddresses: remoteDevice.macAddresses ?? [],
          remotelyAlias: remoteDevice.alias,
          remotelyTags: remoteDevice.tags,
          remotelyNotes: remoteDevice.notes,
          remotelyGroupId: remoteDevice.deviceGroupID,
          remotelyGroupName: groupName,
          estado: remoteDevice.isOnline ? 'online' : 'offline',
          ...(remoteDevice.isOnline && { ultimoContacto: new Date(remoteDevice.lastOnline) }),
        });
        logger.info(`Dispositivo "${remoteDevice.deviceName ?? remoteDevice.id}" dado de alta automáticamente`, {
          remotelyId: remoteDevice.id,
          empresaId: mappedCompanyId,
        });
        touchedCompanies.add(mappedCompanyId);
        continue; // status/telemetría se completan en el próximo ciclo, ya como device existente
      }

      const newStatus: DeviceStatus = remoteDevice.isOnline ? 'online' : 'offline';
      const previousStatus = localDevice.estado;
      const agentVersionChanged =
        Boolean(remoteDevice.agentVersion) && remoteDevice.agentVersion !== localDevice.agentVersion;
      const macAddressesChanged =
        Boolean(remoteDevice.macAddresses) && !sameStringSet(remoteDevice.macAddresses!, localDevice.macAddresses);

      const groupName = remoteDevice.deviceGroupID ? (groupMap.get(remoteDevice.deviceGroupID) ?? null) : null;
      const aliasChanged = remoteDevice.alias !== localDevice.remotelyAlias;
      const tagsChanged = remoteDevice.tags !== localDevice.remotelyTags;
      const notesChanged = remoteDevice.notes !== localDevice.remotelyNotes;
      const groupChanged =
        remoteDevice.deviceGroupID !== localDevice.remotelyGroupId || groupName !== localDevice.remotelyGroupName;
      // Si el grupo de este device mapea a una empresa distinta a la actual,
      // se reasigna — mismo criterio "siempre sincronizado" que agentVersion/
      // tags (confirmado con el usuario), no algo que haya que tocar a mano.
      const empresaChanged = Boolean(mappedCompanyId) && mappedCompanyId !== localDevice.empresaId;

      // Solo escribe en Postgres cuando algo realmente cambió — comparado
      // contra el valor YA CARGADO de localDevice, sin un round-trip extra a
      // Redis solo para detectar el cambio. Sin este guard, sería un UPDATE
      // por dispositivo cada 5s para refrescar un timestamp que nadie
      // necesita con esa granularidad (para eso está el cache de abajo).
      if (
        previousStatus !== newStatus ||
        agentVersionChanged ||
        macAddressesChanged ||
        aliasChanged ||
        tagsChanged ||
        notesChanged ||
        groupChanged ||
        empresaChanged
      ) {
        const previousEmpresaId = localDevice.empresaId;
        await deviceRepository.update(localDevice.id, {
          estado: newStatus,
          ...(newStatus === 'online' && { ultimoContacto: new Date(remoteDevice.lastOnline) }),
          ...(agentVersionChanged && { agentVersion: remoteDevice.agentVersion! }),
          ...(macAddressesChanged && { macAddresses: remoteDevice.macAddresses! }),
          ...(aliasChanged && { remotelyAlias: remoteDevice.alias }),
          ...(tagsChanged && { remotelyTags: remoteDevice.tags }),
          ...(notesChanged && { remotelyNotes: remoteDevice.notes }),
          ...(groupChanged && { remotelyGroupId: remoteDevice.deviceGroupID, remotelyGroupName: groupName }),
          ...(empresaChanged && { empresa: { connect: { id: mappedCompanyId! } } }),
        });
        touchedCompanies.add(previousEmpresaId);
        if (empresaChanged) {
          touchedCompanies.add(mappedCompanyId!);
          logger.info(`Dispositivo ${localDevice.nombre} reasignado de empresa por mapeo de grupo de Remotely`, {
            deviceId: localDevice.id,
            empresaAnterior: previousEmpresaId,
            empresaNueva: mappedCompanyId,
          });
        }
      }

      // El cache de Redis sí se refresca en cada ciclo (barato, y es lo que
      // permite saber el estado "ahora mismo" entre escrituras a Postgres).
      await cacheService.set(CacheKeys.deviceStatus(localDevice.id), newStatus, DEVICE_STATUS_CACHE_TTL);

      const telemetry: DeviceTelemetry = {
        cpuUtilization: remoteDevice.cpuUtilization,
        usedMemoryPercent: remoteDevice.usedMemoryPercent,
        usedStoragePercent: remoteDevice.usedStoragePercent,
        drives: remoteDevice.drives ?? [],
        currentUser: remoteDevice.currentUser,
        updatedAt: new Date().toISOString(),
      };
      await cacheService.set(CacheKeys.deviceTelemetry(localDevice.id), telemetry, DEVICE_TELEMETRY_CACHE_TTL);

      if (previousStatus !== newStatus) {
        logger.info(`Dispositivo ${localDevice.nombre} cambió de estado: ${previousStatus} → ${newStatus}`);
        await eventEmitter.emit('device.status.changed', {
          deviceId: localDevice.id,
          remotelyDeviceId: remoteDevice.id,
          previousStatus,
          newStatus,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Invalida la lista cacheada (device:list:*) para que estado/agentVersion
    // recién actualizados se reflejen ahí también, no solo en el status en vivo.
    for (const empresaId of touchedCompanies) {
      await cacheService.invalidatePattern(CachePatterns.devicesForCompany(empresaId));
    }
  }

  // GET /api/remotecontrol/{deviceId} (confirmado contra RemoteControlController)
  // devuelve directamente la URL de sesión como string plano.
  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    const client = await this.getClient();
    try {
      const { data } = await client.get<string>(`/api/remotecontrol/${input.deviceId}`);
      return { joinUrl: data };
    } catch (err) {
      this.handleError(err, 'No se pudo iniciar la sesión remota');
    }
  }

  // POST /api/scripting/executecommand/{mode}/{deviceId} (confirmado contra
  // ScriptingController): el body es el comando en texto plano, no JSON.
  // Esta llamada espera a que el agente REALMENTE ejecute el comando (viaja
  // por SignalR hasta el equipo remoto y vuelve) — puede tardar más que una
  // consulta normal, de ahí el timeout más largo.
  //
  // BUG CONOCIDO del server de Remotely (confirmado leyendo su código fuente):
  // internamente, ExecuteCommand espera hasta 30s a que
  // AgentHub.ApiScriptResults reciba el resultado (correlacionado por un
  // requestID) y si no llega a tiempo devuelve 404 — PERO el comando puede
  // haberse ejecutado igual (queda en el historial propio de Remotely) si el
  // callback del agente nunca pobló ese diccionario. Por eso, ante un 404 acá
  // no asumimos que falló: se intenta recuperar el resultado real desde
  // GET /api/scriptresults (que si lo tiene, porque esa persistencia es
  // independiente del mecanismo de correlación que falló).
  async executeScript(input: ExecuteScriptInput): Promise<ExecuteScriptResult> {
    const client = await this.getClient();
    const mode = SHELL_MODE[input.shell];
    const path = `/api/scripting/executecommand/${mode}/${input.deviceId}`;
    const requestedAt = new Date();
    logger.debug(`Remotely executeScript -> POST ${client.defaults.baseURL}${path}`);

    try {
      const { data } = await client.post<ExecuteScriptResult>(path, input.script, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: (input.timeoutSeconds ?? 60) * 1000 + 15_000,
      });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        const recovered = await this.recoverScriptResult(input.deviceId, input.script, requestedAt);
        if (recovered) {
          logger.warn(
            'executeScript: Remotely devolvió 404 en la espera síncrona, pero el script SÍ se ejecutó — recuperado vía GET /api/scriptresults (bug conocido de Remotely, ver comentario arriba)',
            { deviceId: input.deviceId },
          );
          return recovered;
        }
      }
      this.handleError(err, 'No se pudo ejecutar el script en el dispositivo');
    }
  }

  // GET /api/scriptresults (confirmado EN VIVO contra el servidor real) trae
  // TODOS los resultados de la organización — no hay filtro por dispositivo
  // en el server, así que se filtra acá. Se usa como respaldo cuando
  // executeScript recibe un 404 pese a que el script sí corrió. OJO: este
  // endpoint devuelve las keys en PascalCase (ID/DeviceID/ScriptInput/...),
  // NO camelCase como el resto de la API — confirmado en vivo, no es un typo.
  async listScriptResults(): Promise<RemotelyScriptResultRaw[]> {
    const client = await this.getClient();
    try {
      const { data } = await client.get<RemotelyScriptResultRaw[]>('/api/scriptresults');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      this.handleError(err, 'No se pudo obtener el historial de scripts de Remotely');
    }
  }

  // No tenemos el requestID/commandId real (por eso mismo se perdió — ver el
  // comentario en executeScript), así que se matchea por lo único disponible:
  // mismo dispositivo, mismo texto de comando exacto, y timestamp posterior a
  // cuando se disparó nuestro request (con 5s de margen por posible desfasaje
  // de reloj entre nuestro server y el de Remotely). Si dos ejecuciones
  // idénticas del mismo comando contra el mismo equipo caen en la misma
  // ventana, se toma la más reciente — un falso positivo posible pero
  // improbable en uso normal. El resultado se remapea a la forma camelCase de
  // ExecuteScriptResult para que el resto del código no tenga que lidiar con
  // las dos convenciones de casing.
  private async recoverScriptResult(
    deviceId: string,
    scriptInput: string,
    requestedAt: Date,
  ): Promise<ExecuteScriptResult | null> {
    try {
      const results = await this.listScriptResults();
      const cutoff = requestedAt.getTime() - 5_000;
      const candidates = results
        .filter((r) => r.DeviceID === deviceId && r.ScriptInput === scriptInput)
        .filter((r) => new Date(r.TimeStamp).getTime() >= cutoff)
        .sort((a, b) => new Date(b.TimeStamp).getTime() - new Date(a.TimeStamp).getTime());

      const match = candidates[0];
      if (!match) return null;

      return {
        id: match.ID,
        deviceID: match.DeviceID,
        organizationID: match.OrganizationID,
        shell: match.Shell,
        scriptInput: match.ScriptInput,
        standardOutput: match.StandardOutput,
        errorOutput: match.ErrorOutput,
        hadErrors: match.HadErrors,
        runTime: match.RunTime,
        timeStamp: match.TimeStamp,
        senderUserName: match.SenderUserName,
      };
    } catch (err) {
      logger.warn('recoverScriptResult: no se pudo consultar /api/scriptresults', {
        error: err instanceof Error ? err.message : err,
      });
      return null;
    }
  }

  // Remotely no expone un endpoint REST de historial de sesiones por
  // dispositivo — por eso RemotelyController.sessionHistory usa
  // remotelySessionRepository (nuestra propia tabla), no este método.
  async getSessionHistory(_deviceId: string): Promise<RemoteSessionHistoryEntry[]> {
    return [];
  }

  private handleError(err: unknown, message: string): never {
    if (axios.isAxiosError(err)) {
      logger.error(`${message}: ${err.message}`, { response: err.response?.data, status: err.response?.status });
      throw new AppError(message, err.response?.status ?? 502);
    }
    throw err;
  }
}

export const remotelyService = new RemotelyService();
