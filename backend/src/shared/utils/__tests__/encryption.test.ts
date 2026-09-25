import { encryptionService } from '../encryption.js';

describe('encryptionService', () => {
  it('cifra y descifra un valor, dando ida y vuelta el texto original', () => {
    const plain = 'dato-sensible-123';
    const encrypted = encryptionService.encrypt(plain);

    expect(encrypted).not.toBe(plain);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    expect(encryptionService.decrypt(encrypted)).toBe(plain);
  });

  it('produce un IV distinto en cada llamada (mismo texto, cifrado distinto)', () => {
    const plain = 'mismo-valor';
    expect(encryptionService.encrypt(plain)).not.toBe(encryptionService.encrypt(plain));
  });

  it('devuelve el valor tal cual si no tiene el formato iv:authTag:data (dato preexistente sin cifrar)', () => {
    expect(encryptionService.decrypt('valor-plano-sin-cifrar')).toBe('valor-plano-sin-cifrar');
  });

  it('hashea una contraseña y valida el hash contra el original', async () => {
    const hash = await encryptionService.hashPassword('Admin123!@#');
    expect(hash).not.toBe('Admin123!@#');
    expect(await encryptionService.comparePassword('Admin123!@#', hash)).toBe(true);
    expect(await encryptionService.comparePassword('otra-cosa', hash)).toBe(false);
  });

  it('rechaza contraseñas que no cumplen los requisitos mínimos', () => {
    const result = encryptionService.validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
