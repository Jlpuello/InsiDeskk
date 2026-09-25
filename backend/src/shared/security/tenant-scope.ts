import { getCurrentUser } from '../utils/context.js';
import { ForbiddenError } from '../utils/error.handler.js';

// Consolida la regla "admin ve/edita todo, cliente/técnico solo lo de su
// propia empresa" — antes de este módulo estaba reimplementada de forma
// independiente en al menos 5 servicios (tickets, usuarios, inventario,
// dispositivos, actividades) y como chequeo inline en varios controllers más
// (cotizaciones, tickets, actividades). Usar siempre esto en vez de escribir
// la regla de nuevo — una sola versión, un solo lugar para corregirla si
// hace falta.
//
// Lee el usuario actual del AsyncLocalStorage (ver shared/utils/context.ts),
// poblado por verifyJWT a partir del mismo payload que llena req.user — así
// que sirve igual desde un controller (con req) que desde un service (sin
// acceso a req).

// Para listas/creación: si el usuario autenticado es admin, respeta el
// empresaId que pidió (o ninguno, para ver "todas"); cliente/tecnico quedan
// forzados a su propia empresa sin importar qué manden.
export function resolveEmpresaId(requested?: string): string | undefined {
  const current = getCurrentUser();
  if (!current) return requested;
  if (current.rol === 'admin') return requested;
  return current.empresaId;
}

// Para verificar que un recurso YA cargado (con su empresaId real) le
// pertenece al usuario actual — admin siempre pasa.
export function isOwnCompany(empresaId: string): boolean {
  const current = getCurrentUser();
  if (!current) return false;
  return current.rol === 'admin' || empresaId === current.empresaId;
}

export function assertOwnCompanyOrAdmin(empresaId: string, message = 'No tenés acceso a este recurso'): void {
  if (!isOwnCompany(empresaId)) throw new ForbiddenError(message);
}
