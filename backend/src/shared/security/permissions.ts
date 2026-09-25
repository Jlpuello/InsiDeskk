import { getPrismaClient } from '../prisma/client.js';
import { getCurrentUser, getCurrentUserId } from '../utils/context.js';
import { ForbiddenError } from '../utils/error.handler.js';
import { asyncHandler } from '../utils/async-handler.js';

// Capacidades puntuales que se pueden otorgar a un usuario además de lo que
// ya le da su rol — ver User.permisos. Reemplaza al viejo patrón de agregar
// una columna booleana nueva por cada feature que necesite "solo ciertos
// usuarios pueden hacer X" (así nació esAprobador, y así iba a nacer la
// próxima). Agregar una capacidad nueva es agregar un string acá, no una
// migración de schema.
export const PERMISSIONS = [
  'quotes:approve',
  'inventory:view',
  'inventory:export',
  'quotes:manage',
  'devices:remote-connect',
  'devices:remote-script',
  'documents:export',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Metadata para la UI (ver Usuarios → Permisos) — qué rol puede tener cada
// capacidad y cómo mostrarla. hasPermission() en sí no usa esto: es admin
// bypass + array.includes, sin importar el rol.
export const PERMISSION_CATALOG: { key: Permission; rol: 'tecnico' | 'cliente'; label: string; description: string }[] = [
  { key: 'inventory:view', rol: 'tecnico', label: 'Inventario', description: 'Ver y gestionar el inventario técnico (routers, switches, cámaras, etc.).' },
  { key: 'inventory:export', rol: 'tecnico', label: 'Exportar inventario', description: 'Descargar el Excel completo de inventario.' },
  { key: 'quotes:manage', rol: 'tecnico', label: 'Cotizaciones', description: 'Crear, enviar, cancelar y gestionar cotizaciones.' },
  { key: 'devices:remote-connect', rol: 'tecnico', label: 'Conexión remota', description: 'Iniciar sesión remota y ejecutar escaneos de hardware/red/software en un dispositivo.' },
  { key: 'devices:remote-script', rol: 'tecnico', label: 'Ejecutar scripts remotos', description: 'Ejecutar un script arbitrario en un dispositivo remoto — capacidad sensible, ejecuta código.' },
  { key: 'quotes:approve', rol: 'cliente', label: 'Aprobador de cotizaciones', description: 'Puede autorizar o rechazar cotizaciones de su empresa.' },
  { key: 'documents:export', rol: 'cliente', label: 'Exportar documentos', description: 'Descargar/imprimir reportes de sus tickets y dispositivos, y los PDF/documentos de sus cotizaciones.' },
];

// admin nunca necesita permisos explícitos en el array — mismo criterio de
// "bypass total" que ya se usa en toda la app (resolveEmpresaId, isOwnCompany).
export function hasPermission(user: { rol: string; permisos: string[] }, permission: Permission): boolean {
  return user.rol === 'admin' || user.permisos.includes(permission);
}

// A diferencia de resolveEmpresaId/isOwnCompany (que solo leen rol/empresaId
// del contexto), `permisos` nunca se guardó en el JWT ni en el
// AsyncLocalStorage — meterlo en el JWT lo dejaría desactualizado hasta el
// próximo login apenas un admin lo cambiara. Se resuelve con una consulta
// puntual por PK (indexada, barata) solo en las rutas que de verdad la usan.
export async function currentUserHasPermission(permission: Permission): Promise<boolean> {
  const current = getCurrentUser();
  if (!current) return false;
  if (current.rol === 'admin') return true;

  const userId = getCurrentUserId();
  if (!userId) return false;

  const record = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { permisos: true } });
  return !!record?.permisos.includes(permission);
}

export function requirePermission(permission: Permission) {
  return asyncHandler(async (_req, _res, next) => {
    if (!(await currentUserHasPermission(permission))) {
      throw new ForbiddenError(`No tenés el permiso "${permission}" para esta acción`);
    }
    next();
  });
}

// Para endpoints de lectura de archivos ya generados (PDF de cotización,
// documentos adjuntos, acta de entrega) que hoy están abiertos a "cualquier
// rol autenticado de la misma empresa" (chequeado aparte con
// assertOwnCompanyOrAdmin). Acá solo se agrega una restricción ADICIONAL para
// cliente — admin/técnico nunca se ven afectados por `documents:export`,
// sigan viendo estos archivos como parte de gestionar el ticket/actividad.
export async function assertDocumentExportAllowed(): Promise<void> {
  const current = getCurrentUser();
  if (current?.rol === 'cliente' && !(await currentUserHasPermission('documents:export'))) {
    throw new ForbiddenError('No tenés el permiso "documents:export" para esta acción');
  }
}
