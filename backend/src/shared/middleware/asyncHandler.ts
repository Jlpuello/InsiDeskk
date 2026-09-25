// Movido a shared/utils/async-handler.ts (ruta usada por los controllers en la
// migración a Prisma). Se re-exporta aquí para no tener que tocar los routes
// ya existentes que todavía importan desde esta ruta.
export { asyncHandler } from '../utils/async-handler.js';
