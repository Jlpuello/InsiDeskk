import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Laptop,
  Building2,
  Bot,
  Settings,
  X,
  ClipboardList,
  Boxes,
  FileCheck,
  Receipt,
  Users,
  ScrollText,
  MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { hasPermission, type Permission } from '../security/permissions.ts';

type NavGroup = 'Operación' | 'Recursos' | 'Comercial' | 'Administración';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  group: NavGroup;
  adminOnly: boolean;
  staffOnly: boolean;
  clienteOnly: boolean;
  // Además del rol — para secciones que un admin puede habilitar/deshabilitar
  // por técnico puntual (ver Usuarios → Permisos). admin siempre pasa
  // (bypass de hasPermission), así que no necesita nada acá.
  permission?: Permission;
}

// El orden de este array define el orden de los grupos en el menú — un
// grupo sin ítems visibles para el usuario actual simplemente no imprime su
// título (ver el filtro más abajo).
const GROUP_ORDER: NavGroup[] = ['Operación', 'Recursos', 'Comercial', 'Administración'];

const NAV_ITEMS: NavItem[] = [
  // KPIs de la operación completa — no son de un cliente puntual, así que
  // queda fuera de su alcance a propósito (igual que Inventario/Cotizaciones
  // más abajo). Ver HomeRoute: si un cliente entra a "/" directo, cae a
  // /tickets en vez de ver esto.
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Operación', adminOnly: false, staffOnly: true, clienteOnly: false },
  { to: '/tickets', label: 'Tickets', icon: Ticket, end: false, group: 'Operación', adminOnly: false, staffOnly: false, clienteOnly: false },
  { to: '/activities', label: 'Actividades', icon: ClipboardList, end: false, group: 'Operación', adminOnly: false, staffOnly: false, clienteOnly: false },
  // Bandeja del chat de la landing page (/chat) — gente de una empresa
  // cliente sin acceso al portal. Un cliente con portal ya tiene Tickets.
  { to: '/inbox', label: 'Mensajes', icon: MessageCircle, end: false, group: 'Operación', adminOnly: false, staffOnly: true, clienteOnly: false },
  // Herramienta operativa interna (hoja de vida de hardware, escaneos,
  // conexión remota) — mismo criterio que Inventario, no es algo que un
  // cliente necesite ver directamente.
  { to: '/devices', label: 'Dispositivos', icon: Laptop, end: false, group: 'Recursos', adminOnly: false, staffOnly: true, clienteOnly: false },
  // Inventario (routers/switches/APs/impresoras/DVRs/cámaras/control de
  // accesos, cargados a mano) queda fuera del alcance del cliente a
  // propósito — herramienta operativa interna, ver InventoryList. Dentro de
  // staff, un técnico puntual puede tenerla apagada (inventory:view).
  { to: '/inventory', label: 'Inventario', icon: Boxes, end: false, group: 'Recursos', adminOnly: false, staffOnly: true, clienteOnly: false, permission: 'inventory:view' },
  // Vista general para ver en qué estado está cada cotización sin entrar
  // ticket por ticket — crear/enviar una nueva sigue siendo desde el ticket
  // mismo (QuoteSection). Un técnico puntual puede tenerla apagada
  // (quotes:manage) sin perder la vista embebida en el ticket.
  { to: '/quotes', label: 'Cotizaciones', icon: Receipt, end: false, group: 'Comercial', adminOnly: false, staffOnly: true, clienteOnly: false, permission: 'quotes:manage' },
  // Solo para el cliente que puede aprobar cotizaciones (ver Usuarios →
  // Permisos) — admin/técnico gestionan la cotización desde el ticket mismo
  // (QuoteSection), no necesitan esta vista.
  { to: '/approvals', label: 'Aprobaciones', icon: FileCheck, end: false, group: 'Comercial', adminOnly: false, staffOnly: false, clienteOnly: true, permission: 'quotes:approve' },
  { to: '/companies', label: 'Empresas', icon: Building2, end: false, group: 'Administración', adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/users', label: 'Usuarios', icon: Users, end: false, group: 'Administración', adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/agents', label: 'Agentes', icon: Bot, end: false, group: 'Administración', adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/logs', label: 'Logs', icon: ScrollText, end: false, group: 'Administración', adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/settings', label: 'Configuración', icon: Settings, end: false, group: 'Administración', adminOnly: true, staffOnly: false, clienteOnly: false },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

// Debajo de md, el sidebar es un drawer fuera de pantalla (fixed + translate)
// que se abre con el botón de hamburguesa en AppLayout; de md en adelante
// vuelve a ser la columna fija de siempre (md:static anula el fixed).
export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const user = useAuthStore((state) => state.user);

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || user?.rol === 'admin') &&
      (!item.staffOnly || user?.rol === 'admin' || user?.rol === 'tecnico') &&
      (!item.clienteOnly || user?.rol === 'cliente') &&
      (!item.permission || hasPermission(user, item.permission)),
  );

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Ticket size={17} />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-gray-900">InsiDesk</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Mesa de ayuda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {GROUP_ORDER.map((group) => {
            const items = visibleItems.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className="mb-1 mt-4 first:mt-0">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group}</p>
                {items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-md border-l-[3px] py-2 pl-2.5 pr-3 text-sm transition-colors',
                        isActive
                          ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700'
                          : 'border-transparent font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
