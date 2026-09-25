import type { PrismaClient } from '@prisma/client';
import { encryptionService } from '../../utils/encryption.js';
import { logger } from '../../utils/logger.js';

// Nota: el hashing de password NO se hace acá — AuthService ya llama a
// encryptionService.hashPassword() antes de crear el usuario (hashear dos
// veces rompería el login). Este middleware encripta/desencripta en reposo:
// - Device.ipLocal / ipPublica / remotelyId / hwUuid / hwSerialNumber
// - Device.macAddresses / hwStorageSerials (arrays, cada elemento por separado)
// - RemotelySession.remotelySessionId
//
// PlatformSettings.remotelyApiKeySecret es un caso aparte: se encripta acá en
// el write, pero DELIBERADAMENTE no entra en decryptFields() ni en el
// auto-decrypt de lecturas. Es un secreto, no un dato-que-se-muestra-enmascarado
// — la única vía para obtener el valor real es el decrypt explícito dentro de
// PlatformSettingsService (para que RemotelyService pueda autenticarse), nunca
// automático en cualquier findMany/findUnique que toque esa tabla.
// remotelyApiKeyId, en cambio, NO es secreto (Remotely lo muestra siempre en
// su tabla de tokens) — se guarda en claro, sin pasar por este middleware.

const DEVICE_ENCRYPTED_FIELDS = ['ipLocal', 'ipPublica', 'remotelyId', 'hwUuid', 'hwSerialNumber'] as const;
const DEVICE_ENCRYPTED_ARRAY_FIELDS = ['macAddresses', 'hwStorageSerials'] as const;

// InventoryEquipment (routers/switches/APs/impresoras/DVRs/cámaras IP/control
// de accesos cargados a mano — ver inventory feature): mismo criterio que
// Device para identificadores de red, más credenciales de administración y
// notas de configuración, que acá SÍ son secretos reales (no solo
// identificadores informativos) — ver el comentario en inventory.service.ts
// sobre por qué nunca salen en exportaciones.
const INVENTORY_ENCRYPTED_FIELDS = [
  'numeroSerie',
  'ipAddress',
  'macAddress',
  'credencialUsuario',
  'credencialPassword',
  'notasConfiguracion',
] as const;

// Quote (cotizaciones/aprobación de cambios): resueltoIp es evidencia de
// auditoría legal (quién aprobó/rechazó, desde dónde) — mismo criterio que
// las IPs de Device, cifrada en reposo aunque se muestre sin enmascarar
// dentro de la app a admin/técnico.
const QUOTE_ENCRYPTED_FIELDS = ['resueltoIp'] as const;

// Desencripta los campos sensibles en el objeto mismo, y en sus relaciones
// anidadas conocidas (`dispositivo`, `sesionesRemotely`) — un Ticket con
// `include: { dispositivo: true }` no dispara `params.model === 'Device'` de
// nuevo, así que sin este paso extra un Device anidado quedaría sin desencriptar.
function decryptFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;

  for (const field of [
    ...DEVICE_ENCRYPTED_FIELDS,
    ...INVENTORY_ENCRYPTED_FIELDS,
    ...QUOTE_ENCRYPTED_FIELDS,
    'remotelySessionId',
  ]) {
    if (typeof record[field] === 'string') {
      try {
        record[field] = encryptionService.decrypt(record[field] as string);
      } catch (err) {
        logger.error(`No se pudo desencriptar ${field} de ${record.id}: ${(err as Error).message}`);
      }
    }
  }

  for (const field of DEVICE_ENCRYPTED_ARRAY_FIELDS) {
    if (Array.isArray(record[field])) {
      try {
        record[field] = encryptionService.decryptArray(record[field] as string[]);
      } catch (err) {
        logger.error(`No se pudo desencriptar ${field} de ${record.id}: ${(err as Error).message}`);
      }
    }
  }

  if (record.dispositivo && typeof record.dispositivo === 'object') {
    decryptFields(record.dispositivo);
  }
  if (Array.isArray(record.sesionesRemotely)) {
    record.sesionesRemotely.forEach(decryptFields);
  }
}

// Encripta in-place los campos sensibles de un objeto `data` de
// create/update/upsert, según el modelo. Separado de la lógica de $use para
// poder aplicarlo tanto a params.args.data (create/update) como a
// params.args.create/update (upsert — que NO trae un `data` plano, sino esos
// dos sub-objetos con la misma forma).
function encryptWriteData(model: string | undefined, data: Record<string, unknown> | undefined): void {
  if (!data) return;

  if (model === 'Device') {
    // El blind index se calcula ANTES de encriptar (necesita el texto plano);
    // permite seguir buscando por remotelyId (ver device.repository.ts)
    // aunque el valor guardado ya no sea determinístico.
    if (data.remotelyId) {
      data.remotelyIdHash = encryptionService.blindIndex(data.remotelyId as string);
    }
    for (const field of DEVICE_ENCRYPTED_FIELDS) {
      if (data[field]) {
        data[field] = encryptionService.encrypt(data[field] as string);
      }
    }
    // Solo maneja el array plano (nuestro uso real: reemplazar la lista
    // completa). Si algún día se usa `{ set: [...] }` o `{ push: ... }` acá,
    // este bloque no lo detecta — no hace falta hoy, se deja documentado.
    for (const field of DEVICE_ENCRYPTED_ARRAY_FIELDS) {
      if (Array.isArray(data[field])) {
        data[field] = encryptionService.encryptArray(data[field] as string[]);
      }
    }
  }

  if (model === 'InventoryEquipment') {
    for (const field of INVENTORY_ENCRYPTED_FIELDS) {
      if (data[field]) {
        data[field] = encryptionService.encrypt(data[field] as string);
      }
    }
  }

  if (model === 'Quote') {
    for (const field of QUOTE_ENCRYPTED_FIELDS) {
      if (data[field]) {
        data[field] = encryptionService.encrypt(data[field] as string);
      }
    }
  }

  if (model === 'RemotelySession' && data.remotelySessionId) {
    data.remotelySessionId = encryptionService.encrypt(data.remotelySessionId as string);
  }

  if (model === 'PlatformSettings') {
    if (data.remotelyApiKeySecret) {
      data.remotelyApiKeySecret = encryptionService.encrypt(data.remotelyApiKeySecret as string);
    }
    // Mismo criterio que remotelyApiKeySecret (ver comentario arriba):
    // cifrados en escritura, deliberadamente ausentes de decryptFields().
    if (data.whatsappAccessToken) {
      data.whatsappAccessToken = encryptionService.encrypt(data.whatsappAccessToken as string);
    }
    if (data.whatsappAppSecret) {
      data.whatsappAppSecret = encryptionService.encrypt(data.whatsappAppSecret as string);
    }
    if (data.whatsappWebhookVerifyToken) {
      data.whatsappWebhookVerifyToken = encryptionService.encrypt(data.whatsappWebhookVerifyToken as string);
    }
    if (data.aiApiKey) {
      data.aiApiKey = encryptionService.encrypt(data.aiApiKey as string);
    }
    if (data.smtpPassword) {
      data.smtpPassword = encryptionService.encrypt(data.smtpPassword as string);
    }
  }
}

export function setupEncryptionMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    if (params.action === 'create' || params.action === 'update') {
      encryptWriteData(params.model, params.args.data);
    }

    if (params.action === 'upsert') {
      encryptWriteData(params.model, params.args.create);
      encryptWriteData(params.model, params.args.update);
    }

    const result = await next(params);

    // create/update/upsert también se desencriptan: Prisma devuelve la fila tal
    // como quedó guardada (o sea, cifrada) — sin esto, la respuesta de un
    // POST/PUT mostraría el ciphertext crudo en vez del valor real.
    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'upsert' ||
      params.action === 'create' ||
      params.action === 'update'
    ) {
      if (Array.isArray(result)) {
        result.forEach(decryptFields);
      } else if (result) {
        decryptFields(result);
      }
    }

    return result;
  });
}
