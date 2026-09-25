import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Laptop, CircleDot, Clock3, CheckCircle2, XCircle, Wifi, WifiOff, UserCheck } from 'lucide-react';
import { dashboardApi } from '../api/dashboard.api.ts';
import type { DeviceStats, TicketStats } from '../types/dashboard.types.ts';

interface KpiCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  accent: string;
  onClick?: () => void;
}

function KpiCard({ label, value, icon, accent, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${onClick ? 'cursor-pointer transition-colors hover:border-blue-300 hover:bg-blue-50/40' : ''}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [myOpenCount, setMyOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([dashboardApi.getTicketStats(), dashboardApi.getDeviceStats(), dashboardApi.getMyOpenTicketsCount()])
      .then(([tickets, devices, mine]) => {
        if (cancelled) return;
        setTicketStats(tickets);
        setDeviceStats(devices);
        setMyOpenCount(mine);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las estadísticas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="p-6 text-gray-500">Cargando dashboard...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!ticketStats || !deviceStats) return null;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Mis tickets"
          value={myOpenCount}
          icon={<UserCheck size={20} className="text-indigo-700" />}
          accent="bg-indigo-100"
          onClick={() => navigate('/tickets?asignado=yo')}
        />
        <KpiCard label="Tickets totales" value={ticketStats.total} icon={<Ticket size={20} className="text-blue-700" />} accent="bg-blue-100" />
        <KpiCard
          label="Abiertos"
          value={ticketStats.byEstado.abierto}
          icon={<CircleDot size={20} className="text-blue-700" />}
          accent="bg-blue-100"
        />
        <KpiCard
          label="En progreso"
          value={ticketStats.byEstado.en_progreso}
          icon={<Clock3 size={20} className="text-amber-700" />}
          accent="bg-amber-100"
        />
        <KpiCard
          label="Cerrados"
          value={ticketStats.byEstado.cerrado}
          icon={<CheckCircle2 size={20} className="text-green-700" />}
          accent="bg-green-100"
        />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Dispositivos totales" value={deviceStats.total} icon={<Laptop size={20} className="text-gray-700" />} accent="bg-gray-100" />
        <KpiCard
          label="En línea"
          value={deviceStats.byEstado.online}
          icon={<Wifi size={20} className="text-green-700" />}
          accent="bg-green-100"
        />
        <KpiCard
          label="Fuera de línea"
          value={deviceStats.byEstado.offline}
          icon={<WifiOff size={20} className="text-gray-700" />}
          accent="bg-gray-100"
        />
        <KpiCard
          label="En espera"
          value={ticketStats.byEstado.en_espera}
          icon={<XCircle size={20} className="text-purple-700" />}
          accent="bg-purple-100"
        />
      </div>
    </div>
  );
}
