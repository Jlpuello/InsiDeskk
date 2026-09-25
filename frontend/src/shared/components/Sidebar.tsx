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

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  adminOnly: boolean;
  staffOnly: boolean;
  clienteOnly: boolean;
  // Además del rol — para secciones que un admin puede habilitar/deshabilitar
  // por técnico puntual (ver Usuarios → Permisos). admin siempre pasa
  // (bypass de hasPermission), así que no necesita nada acá.
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  // KPIs de la operación completa — no son de un cliente puntual, así que
  // queda fuera de su alcance a propósito (igual que Inventario/Cotizaciones
  // más abajo). Ver HomeRoute: si un cliente entra a "/" directo, cae a
  // /tickets en vez de ver esto.
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, adminOnly: false, staffOnly: true, clienteOnly: false },
  { to: '/tickets', label: 'Tickets', icon: Ticket, end: false, adminOnly: false, staffOnly: false, clienteOnly: false },
  { to: '/activities', label: 'Actividades', icon: ClipboardList, end: false, adminOnly: false, staffOnly: false, clienteOnly: false },
  // Bandeja del chat de la landing page (/chat) — gente de una empresa
  // cliente sin acceso al portal. Un cliente con portal ya tiene Tickets.
  { to: '/inbox', label: 'Mensajes', icon: MessageCircle, end: false, adminOnly: false, staffOnly: true, clienteOnly: false },
  // Herramienta operativa interna (hoja de vida de hardware, escaneos,
  // conexión remota) — mismo criterio que Inventario, no es algo que un
  // cliente necesite ver directamente.
  { to: '/devices', label: 'Dispositivos', icon: Laptop, end: false, adminOnly: false, staffOnly: true, clienteOnly: false },
  // Inventario (routers/switches/APs/impresoras/DVRs/cámaras/control de
  // accesos, cargados a mano) queda fuera del alcance del cliente a
  // propósito — herramienta operativa interna, ver InventoryList. Dentro de
  // staff, un técnico puntual puede tenerla apagada (inventory:view).
  { to: '/inventory', label: 'Inventario', icon: Boxes, end: false, adminOnly: false, staffOnly: true, clienteOnly: false, permission: 'inventory:view' },
  // Vista general para ver en qué estado está cada cotización sin entrar
  // ticket por ticket — crear/enviar una nueva sigue siendo desde el ticket
  // mismo (QuoteSection). Un técnico puntual puede tenerla apagada
  // (quotes:manage) sin perder la vista embebida en el ticket.
  { to: '/quotes', label: 'Cotizaciones', icon: Receipt, end: false, adminOnly: false, staffOnly: true, clienteOnly: false, permission: 'quotes:manage' },
  // Solo para el cliente que puede aprobar cotizaciones (ver Usuarios →
  // Permisos) — admin/técnico gestionan la cotización desde el ticket mismo
  // (QuoteSection), no necesitan esta vista.
  { to: '/approvals', label: 'Aprobaciones', icon: FileCheck, end: false, adminOnly: false, staffOnly: false, clienteOnly: true, permission: 'quotes:approve' },
  { to: '/companies', label: 'Empresas', icon: Building2, end: false, adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/users', label: 'Usuarios', icon: Users, end: false, adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/agents', label: 'Agentes', icon: Bot, end: false, adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/logs', label: 'Logs', icon: ScrollText, end: false, adminOnly: true, staffOnly: false, clienteOnly: false },
  { to: '/settings', label: 'Configuración', icon: Settings, end: false, adminOnly: true, staffOnly: false, clienteOnly: false },
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

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-lg font-semibold">InsiDesk</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.filter(
            (item) =>
              (!item.adminOnly || user?.rol === 'admin') &&
              (!item.staffOnly || user?.rol === 'admin' || user?.rol === 'tecnico') &&
              (!item.clienteOnly || user?.rol === 'cliente') &&
              (!item.permission || hasPermission(user, item.permission)),
          ).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
