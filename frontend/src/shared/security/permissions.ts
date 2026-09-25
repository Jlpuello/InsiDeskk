// Espejo del catálogo de backend/src/shared/security/permissions.ts — mismos
// strings, mismo criterio de bypass para admin. Si se agrega un permiso
// nuevo, hay que sumarlo en los dos lados (no hay forma de compartir código
// entre los dos proyectos hoy).
export const PERMISSION_CATALOG = [
  { key: 'inventory:view', rol: 'tecnico', label: 'Inventario', description: 'Ver y gestionar el inventario técnico (routers, switches, cámaras, etc.).' },
  { key: 'inventory:export', rol: 'tecnico', label: 'Exportar inventario', description: 'Descargar el Excel completo de inventario.' },
  { key: 'quotes:manage', rol: 'tecnico', label: 'Cotizaciones', description: 'Crear, enviar, cancelar y gestionar cotizaciones.' },
  { key: 'devices:remote-connect', rol: 'tecnico', label: 'Conexión remota', description: 'Iniciar sesión remota y ejecutar escaneos de hardware/red/software en un dispositivo.' },
  { key: 'devices:remote-script', rol: 'tecnico', label: 'Ejecutar scripts remotos', description: 'Ejecutar un script arbitrario en un dispositivo remoto — capacidad sensible, ejecuta código.' },
  { key: 'quotes:approve', rol: 'cliente', label: 'Aprobador de cotizaciones', description: 'Puede autorizar o rechazar cotizaciones de su empresa.' },
  { key: 'documents:export', rol: 'cliente', label: 'Exportar documentos', description: 'Descargar/imprimir reportes de sus tickets y dispositivos, y los PDF/documentos de sus cotizaciones.' },
] as const;

export type Permission = (typeof PERMISSION_CATALOG)[number]['key'];

export function permissionsForRole(rol: 'tecnico' | 'cliente') {
  return PERMISSION_CATALOG.filter((p) => p.rol === rol);
}

// admin nunca necesita permisos explícitos — mismo bypass que el backend.
export function hasPermission(
  user: { rol: string; permisos: string[] } | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return user.rol === 'admin' || user.permisos.includes(permission);
}
