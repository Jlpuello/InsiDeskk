// Convenciones de keys de Redis. Las listas de tickets/devices están scoped por
// empresaId (multi-tenant) — nunca cachear una lista filtrada por Prisma/RBAC
// bajo una key que no incluya la empresa, o un tenant puede terminar leyendo
// datos cacheados de otro (ver el comentario en ticket.service.ts).

export const CacheKeys = {
  ticketsList: (empresaId: string, filtersHash: string): string => `ticket:list:${empresaId}:${filtersHash}`,

  devicesList: (empresaId: string, filtersHash: string): string => `device:list:${empresaId}:${filtersHash}`,
  deviceStatus: (id: string): string => `device:${id}:status`,
  deviceTelemetry: (id: string): string => `device:${id}:telemetry`,

  // Global (no scoped por empresa): grupos de Remotely son de toda la
  // organización en Remotely, no un dato por tenant nuestro.
  remotelyDeviceGroups: 'remotely:device-groups',
  // Mapeo grupo de Remotely -> Company nuestra (Configuración → Empresas).
  companiesByRemotelyGroup: 'remotely:companies-by-group',
  // El organizationId de Remotely no cambia nunca para una misma cuenta —
  // TTL largo (ver remotelyService.getOrganizationId()).
  remotelyOrganizationId: 'remotely:organization-id',

  user: (id: string): string => `user:${id}`,

  session: (id: string): string => `session:${id}`,
} as const;

export const CachePatterns = {
  // También invalida el bucket "all": un admin sin empresaId en el filtro
  // cachea su lista bajo esa key literal (ver resolveEmpresaId), y un ticket/
  // device creado para UNA empresa puntual nunca haría match contra
  // `ticket:list:{empresaId}:*` — esa vista de admin quedaba stale hasta que
  // expiraba el TTL (10 min), dando la impresión de que lo creado "se borra".
  ticketsForCompany: (empresaId: string): string[] => [`ticket:list:${empresaId}:*`, `ticket:list:all:*`],
  devicesForCompany: (empresaId: string): string[] => [`device:list:${empresaId}:*`, `device:list:all:*`],
  // Para cuando cambia algo que afecta el WHERE de la lista de tickets sin
  // importar la empresa (ver TicketLevelVisibilityService.update) — a
  // diferencia de ticketsForCompany, no hay una empresa puntual a la que
  // acotar la invalidación.
  allTicketLists: 'ticket:list:*',
  allUsers: 'user:*',
  allSessions: 'session:*',
} as const;
