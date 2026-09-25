/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  // El código fuente importa con extensión ".js" (convención ESM: "./foo.js"
  // resuelve a "./foo.ts" en disco) — sin este mapeo, Jest busca un ".js"
  // real que no existe y todo import relativo falla.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  // Sin mocks de entorno: estos son smoke tests de integración a propósito
  // (DB/Redis reales de dev) — env.ts ya hace dotenv.config() al importarse,
  // así que toma el mismo .env que usa `npm run dev`.
  testMatch: ['**/__tests__/**/*.test.ts'],
  testTimeout: 15000,
};
