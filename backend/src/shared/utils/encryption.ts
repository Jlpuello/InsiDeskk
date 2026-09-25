import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const SALT_ROUNDS = 10;
const AES_ALGORITHM = 'aes-256-gcm';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

// AES-256-GCM necesita una clave de 32 bytes. ENCRYPTION_KEY se espera en hex
// (64 caracteres); ver backend/.env.example (`openssl rand -hex 32`).
function getEncryptionKey(): Buffer {
  if (!env.encryptionKey || env.encryptionKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY debe ser un string hexadecimal de 64 caracteres (32 bytes). Genera uno con: openssl rand -hex 32',
    );
  }
  return Buffer.from(env.encryptionKey, 'hex');
}

export const encryptionService = {
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },

  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Debe tener al menos 8 caracteres');
    if (!/[A-Z]/.test(password)) errors.push('Debe incluir al menos una mayúscula');
    if (!/[a-z]/.test(password)) errors.push('Debe incluir al menos una minúscula');
    if (!/[0-9]/.test(password)) errors.push('Debe incluir al menos un número');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Debe incluir al menos un símbolo');

    return { valid: errors.length === 0, errors };
  },

  // Formato: iv:authTag:ciphertext (todo en hex), para poder desencriptar sin
  // estado adicional. Usado para campos sensibles en reposo (p.ej. IPs de Device).
  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, getEncryptionKey(), iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  },

  decrypt(payload: string): string {
    const [ivHex, authTagHex, dataHex] = payload.split(':');
    if (!ivHex || !authTagHex || !dataHex) {
      // No se pudo parsear (p.ej. el valor nunca fue encriptado); se devuelve tal cual
      // para no romper datos preexistentes o de entornos sin ENCRYPTION_KEY configurada.
      return payload;
    }

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  },

  // AES-256-GCM usa un IV aleatorio: el mismo texto plano da un cifrado distinto
  // cada vez, así que un campo cifrado con encrypt() no se puede buscar con
  // `WHERE campo = valor`. blindIndex() es un HMAC-SHA256 determinístico (mismo
  // valor de entrada → siempre el mismo hash) usado como "índice ciego": se
  // guarda en una columna aparte (p.ej. remotelyIdHash) y se busca por ahí en
  // vez de por el campo cifrado. La clave del HMAC se deriva de ENCRYPTION_KEY
  // con dominio separado, para no reusar la misma clave en dos algoritmos distintos.
  blindIndex(value: string): string {
    const hmacKey = crypto.createHash('sha256').update(`${env.encryptionKey}:blind-index`).digest();
    return crypto.createHmac('sha256', hmacKey).update(value).digest('hex');
  },

  // Para columnas array (p.ej. Device.macAddresses): cada elemento se cifra
  // por separado (su propio IV), así el array guardado es un array de
  // strings "iv:tag:ciphertext" — no un único blob. No hay blind index acá
  // porque hoy no se busca por MAC; si hiciera falta, se agregaría igual que
  // con remotelyId.
  encryptArray(values: string[]): string[] {
    return values.map((v) => this.encrypt(v));
  },

  decryptArray(values: string[]): string[] {
    return values.map((v) => this.decrypt(v));
  },
};
