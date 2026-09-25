// Select explícito para incluir un User como relación anidada (usuarioReporter,
// usuarioAsignado, usuario en notas/sesiones, etc.) SIN pasar passwordHash.
// `include: { usuario: true }` trae el modelo completo con el hash — nunca usar
// eso para una relación de User; usar siempre `select: safeUserSelect`.
export const safeUserSelect = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  rol: true,
  empresaId: true,
  activo: true,
  ultimoLogin: true,
  createdAt: true,
  updatedAt: true,
} as const;
