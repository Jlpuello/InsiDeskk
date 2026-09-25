import type { Request, Response } from 'express';
import Joi from 'joi';
import { remotelyService } from '../services/remotely.service.js';
import { remotelySessionRepository } from '../repositories/remotely-session.repository.js';
import { scriptExecutionRepository } from '../repositories/script-execution.repository.js';
import { deviceService } from '../../devices/index.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { formatHardwareScan, formatNetworkScan, maskRemotelySession } from '../../../shared/utils/mask.js';
import { HARDWARE_SCAN_SCRIPT, parseHardwareScanResult } from '../scripts/hardware-scan.script.js';
import { NETWORK_SCAN_SCRIPT, parseNetworkScanResult } from '../scripts/network-scan.script.js';
import { SOFTWARE_SCAN_SCRIPT, parseSoftwareScanResult } from '../scripts/software-scan.script.js';
import type { ExecuteScriptResult } from '../types/remotely.types.js';

const connectSchema = Joi.object({
  ticketId: Joi.string().uuid(),
});

const executeScriptSchema = Joi.object({
  deviceId: Joi.string().required(),
  shell: Joi.string().valid('powershell', 'bash', 'cmd').required(),
  script: Joi.string().min(1).required(),
  timeoutSeconds: Joi.number().integer().min(1).max(600),
});

// Resuelve el device LOCAL (pasa por RBAC vía deviceService.getById — así un
// tecnico/cliente no puede apuntar a un device de otra empresa solo
// adivinando su id) y devuelve su remotelyId, que es lo que realmente hay que
// mandarle a la API de Remotely (nuestro :id de ruta/body NUNCA es el id que
// Remotely usa internamente).
async function resolveRemotelyDeviceId(localDeviceId: string): Promise<{ localId: string; remotelyId: string }> {
  const device = await deviceService.getById(localDeviceId);
  if (!device.remotelyId) {
    throw new AppError('Este dispositivo no tiene un ID de Remotely asociado', 422);
  }
  return { localId: device.id, remotelyId: device.remotelyId };
}

export const RemotelyController = {
  async listDevices(_req: Request, res: Response): Promise<void> {
    const devices = await remotelyService.listDevices();
    res.status(200).json({ data: devices });
  },

  // Alimenta el selector de "grupo de Remotely" en la gestión de empresas —
  // ver features/companies.
  async listGroups(_req: Request, res: Response): Promise<void> {
    const groups = await remotelyService.listDeviceGroups();
    res.status(200).json({ data: groups });
  },

  // Comandos de instalación del agente para la sección "Agentes" — ver
  // remotelyService.buildAgentScriptInfo (compartido con el link público
  // temporal, ver remotely-public.controller.ts).
  async agentScript(req: Request, res: Response): Promise<void> {
    const info = await remotelyService.buildAgentScriptInfo(req.params.companyId);
    res.status(200).json({ data: info });
  },

  async connect(req: Request, res: Response): Promise<void> {
    const { error, value } = connectSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { localId, remotelyId } = await resolveRemotelyDeviceId(req.params.id);

    const session = await remotelyService.startSession({
      deviceId: remotelyId,
      ticketId: value.ticketId,
    });

    // Se persiste localmente para tener historial auditable (remotely_sessions),
    // independiente de lo que Remotely retenga en su propia base de datos.
    // Remotely no devuelve un sessionId separado (solo la joinUrl), así que
    // guardamos la URL misma como referencia.
    await remotelySessionRepository.create({
      dispositivo: { connect: { id: localId } },
      usuario: { connect: { id: req.user!.id } },
      ...(value.ticketId && { ticket: { connect: { id: value.ticketId } } }),
      remotelySessionId: session.joinUrl,
    });

    res.status(201).json({ data: session });
  },

  async executeScript(req: Request, res: Response): Promise<void> {
    const { error, value } = executeScriptSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { localId, remotelyId } = await resolveRemotelyDeviceId(value.deviceId);
    const startedAt = Date.now();

    try {
      const result = await remotelyService.executeScript({ ...value, deviceId: remotelyId });

      // Se persiste localmente (Remotely no expone un endpoint para listar
      // historial por dispositivo con nuestra auth — ver remotely.service.ts).
      // estado 'completed' es a nivel infra (la llamada funcionó); hadErrors
      // es si el SCRIPT MISMO reportó un error — se guarda en errorMessage
      // para que quede visible igual, sin marcar el intento como failed.
      await scriptExecutionRepository.create({
        dispositivo: { connect: { id: localId } },
        usuario: { connect: { id: req.user!.id } },
        shell: value.shell,
        estado: 'completed',
        output: JSON.stringify(result),
        errorMessage: result.hadErrors ? (result.errorOutput?.join('\n') ?? 'El script reportó errores') : undefined,
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
      });

      res.status(200).json({ data: result });
    } catch (err) {
      await scriptExecutionRepository.create({
        dispositivo: { connect: { id: localId } },
        usuario: { connect: { id: req.user!.id } },
        shell: value.shell,
        estado: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
      });
      throw err;
    }
  },

  // Corre un script fijo (WMI/CIM) para extraer tipo/velocidad/slots de RAM,
  // datos que /api/devices de Remotely no trae. Reusa el mismo canal de
  // ejecución que "Ejecutar script" (executeScript + persistencia de
  // historial), así que queda auditado igual que cualquier otro script.
  async hardwareScan(req: Request, res: Response): Promise<void> {
    const { localId, remotelyId } = await resolveRemotelyDeviceId(req.params.id);
    const startedAt = Date.now();

    let rawResult: ExecuteScriptResult;
    try {
      rawResult = await remotelyService.executeScript({
        deviceId: remotelyId,
        shell: 'powershell',
        script: HARDWARE_SCAN_SCRIPT,
        timeoutSeconds: 30,
      });
    } catch (err) {
      await scriptExecutionRepository.create({
        dispositivo: { connect: { id: localId } },
        usuario: { connect: { id: req.user!.id } },
        shell: 'powershell',
        scriptNombre: 'hardware-scan',
        estado: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
      });
      throw err;
    }

    await scriptExecutionRepository.create({
      dispositivo: { connect: { id: localId } },
      usuario: { connect: { id: req.user!.id } },
      shell: 'powershell',
      scriptNombre: 'hardware-scan',
      estado: 'completed',
      output: JSON.stringify(rawResult),
      duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
    });

    const parsed = parseHardwareScanResult(rawResult);
    if (!parsed) {
      // El script SÍ corrió (por eso el historial arriba queda "completed") —
      // lo que falló fue interpretar la salida, probablemente porque la forma
      // real del ScriptResult de Remotely no coincide con lo que asumimos
      // (ver el comentario en types/remotely.types.ts). Queda logueado el
      // crudo para ajustar el parser.
      throw new AppError(
        'El script corrió pero no se pudo interpretar su salida. Revisá los logs del servidor.',
        502,
      );
    }

    const device = await deviceService.saveHardwareInfo(localId, parsed);
    res.status(200).json({ data: formatHardwareScan(device) });
  },

  // Categoría "Red" de la hoja de vida — mismo mecanismo que hardwareScan
  // (script fijo + recuperación de resultado + persistencia de historial).
  async networkScan(req: Request, res: Response): Promise<void> {
    const { localId, remotelyId } = await resolveRemotelyDeviceId(req.params.id);
    const startedAt = Date.now();

    let rawResult: ExecuteScriptResult;
    try {
      rawResult = await remotelyService.executeScript({
        deviceId: remotelyId,
        shell: 'powershell',
        script: NETWORK_SCAN_SCRIPT,
        timeoutSeconds: 30,
      });
    } catch (err) {
      await scriptExecutionRepository.create({
        dispositivo: { connect: { id: localId } },
        usuario: { connect: { id: req.user!.id } },
        shell: 'powershell',
        scriptNombre: 'network-scan',
        estado: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
      });
      throw err;
    }

    await scriptExecutionRepository.create({
      dispositivo: { connect: { id: localId } },
      usuario: { connect: { id: req.user!.id } },
      shell: 'powershell',
      scriptNombre: 'network-scan',
      estado: 'completed',
      output: JSON.stringify(rawResult),
      duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
    });

    const parsed = parseNetworkScanResult(rawResult);
    if (!parsed) {
      throw new AppError(
        'El script corrió pero no se pudo interpretar su salida. Revisá los logs del servidor.',
        502,
      );
    }

    const device = await deviceService.saveNetworkInfo(localId, parsed);
    res.status(200).json({ data: formatNetworkScan(device) });
  },

  // Categoría "Software instalado" — mismo mecanismo, sin enmascarado (nombre/
  // versión/editor de programas no son identificadores sensibles).
  async softwareScan(req: Request, res: Response): Promise<void> {
    const { localId, remotelyId } = await resolveRemotelyDeviceId(req.params.id);
    const startedAt = Date.now();

    let rawResult: ExecuteScriptResult;
    try {
      rawResult = await remotelyService.executeScript({
        deviceId: remotelyId,
        shell: 'powershell',
        script: SOFTWARE_SCAN_SCRIPT,
        timeoutSeconds: 30,
      });
    } catch (err) {
      await scriptExecutionRepository.create({
        dispositivo: { connect: { id: localId } },
        usuario: { connect: { id: req.user!.id } },
        shell: 'powershell',
        scriptNombre: 'software-scan',
        estado: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Error desconocido',
        duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
      });
      throw err;
    }

    await scriptExecutionRepository.create({
      dispositivo: { connect: { id: localId } },
      usuario: { connect: { id: req.user!.id } },
      shell: 'powershell',
      scriptNombre: 'software-scan',
      estado: 'completed',
      output: JSON.stringify(rawResult),
      duracionSegundos: Math.round((Date.now() - startedAt) / 1000),
    });

    const parsed = parseSoftwareScanResult(rawResult);
    if (!parsed) {
      throw new AppError(
        'El script corrió pero no se pudo interpretar su salida. Revisá los logs del servidor.',
        502,
      );
    }

    const device = await deviceService.saveSoftwareInfo(localId, parsed);
    res.status(200).json({ data: { apps: device.swApps, totalCount: device.swTotalCount, swScannedAt: device.swScannedAt } });
  },

  async sessionHistory(req: Request, res: Response): Promise<void> {
    // getById gatea por RBAC — sin esto, cualquier admin/tecnico podía pedir
    // el historial de un device de otra empresa con solo adivinar su id.
    const device = await deviceService.getById(req.params.id);
    const history = await remotelySessionRepository.findByDeviceId(device.id);
    // Historial informativo: se enmascara. El endpoint /connect (arriba) no se
    // enmascara porque su joinUrl/sessionId es el valor operativo que se
    // necesita para conectarse de verdad, no un dato de solo lectura.
    res.status(200).json({ data: history.map(maskRemotelySession) });
  },

  async scriptHistory(req: Request, res: Response): Promise<void> {
    const device = await deviceService.getById(req.params.id);
    const history = await scriptExecutionRepository.findByDeviceId(device.id);
    res.status(200).json({ data: history });
  },
};
