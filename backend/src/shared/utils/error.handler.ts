// El spec de Prisma referencia `shared/utils/error.handler`; se mantiene una
// sola implementación en AppError.ts y este archivo solo re-exporta, para no
// tener dos clases AppError divergentes en el proyecto.
export { AppError, NotFoundError, UnauthorizedError, ForbiddenError } from './AppError.js';
