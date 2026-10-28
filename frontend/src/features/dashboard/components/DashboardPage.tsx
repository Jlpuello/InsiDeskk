import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Laptop, CircleDot, Clock3, CheckCircle2, Wifi, WifiOff, UserCheck, Hourglass } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi } from '../api/dashboard.api.ts';
import type { DeviceStats, TicketPriority, TicketStats, TicketStatus, TicketTrendPoint } from '../types/dashboard.types.ts';

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
      className={`flex flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${onClick ? 'cursor-pointer transition-colors hover:border-blue-300 hover:bg-blue-50/40' : ''}`}
      style={{ minWidth: 150 }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-semibold leading-tight text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 bg-white p-5 shadow-sm" style={{ minWidth: 280 }}>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {subtitle && <p className="mb-3 text-xs text-gray-400">{subtitle}</p>}
      {children}
    </div>
  );
}

const ESTADO_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abiertos',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  esperando_aprobacion: 'Esperando aprobación',
  cerrado: 'Cerrados',
  cancelado: 'Cancelados',
};
// Mismo criterio de color que el resto de la app: azul para "activo/en
// curso", ámbar para "esperando a alguien", gris para "terminado/inactivo" —
// nunca rojo/verde como único par (accesibilidad: deben distinguirse también
// por luminosidad, no solo por matiz).
const ESTADO_COLORS: Record<TicketStatus, string> = {
  abierto: '#2563eb',
  en_progreso: '#4f46e5',
  en_espera: '#d97706',
  esperando_aprobacion: '#d97706',
  cerrado: '#9ca3af',
  cancelado: '#d1d5db',
};

const PRIORIDAD_LABELS: Record<TicketPriority, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
const PRIORIDAD_COLORS: Record<TicketPriority, string> = { baja: '#9ca3af', media: '#2563eb', alta: '#ea580c', critica: '#dc2626' };
const PRIORIDAD_ORDER: TicketPriority[] = ['critica', 'alta', 'media', 'baja'];

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [myOpenCount, setMyOpenCount] = useState(0);
  const [priorityStats, setPriorityStats] = useState<Record<TicketPriority, number> | null>(null);
  const [trend, setTrend] = useState<TicketTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      dashboardApi.getTicketStats(),
      dashboardApi.getDeviceStats(),
      dashboardApi.getMyOpenTicketsCount(),
      dashboardApi.getTicketsByPriority(),
      dashboardApi.getTicketTrend(),
    ])
      .then(([tickets, devices, mine, priority, trendPoints]) => {
        if (cancelled) return;
        setTicketStats(tickets);
        setDeviceStats(devices);
        setMyOpenCount(mine);
        setPriorityStats(priority);
        setTrend(trendPoints);
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
  if (!ticketStats || !deviceStats || !priorityStats) return null;

  // Solo estados con al menos 1 ticket, para no saturar la dona con
  // "Cancelados · 0" cuando nunca pasó — pero siempre al menos un slice para
  // que el gráfico no quede vacío si todo es 0.
  const estadoSlices = (Object.entries(ticketStats.byEstado) as [TicketStatus, number][])
    .filter(([, count]) => count > 0)
    .map(([estado, count]) => ({ estado, count, label: ESTADO_LABELS[estado], color: ESTADO_COLORS[estado] }));

  const prioridadBars = PRIORIDAD_ORDER.map((p) => ({ prioridad: p, label: PRIORIDAD_LABELS[p], count: priorityStats[p] }));
  const maxPrioridad = Math.max(1, ...prioridadBars.map((b) => b.count));

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">Resumen operativo de tickets y dispositivos.</p>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tickets</div>
      <div className="mb-6 flex flex-wrap gap-3">
        <KpiCard
          label="Mis tickets"
          value={myOpenCount}
          icon={<UserCheck size={18} className="text-indigo-700" />}
          accent="bg-indigo-100"
          onClick={() => navigate('/tickets?asignado=yo')}
        />
        <KpiCard label="Total" value={ticketStats.total} icon={<Ticket size={18} className="text-gray-700" />} accent="bg-gray-100" />
        <KpiCard
          label="Abiertos"
          value={ticketStats.byEstado.abierto}
          icon={<CircleDot size={18} className="text-blue-700" />}
          accent="bg-blue-100"
        />
        <KpiCard
          label="En progreso"
          value={ticketStats.byEstado.en_progreso}
          icon={<Clock3 size={18} className="text-indigo-700" />}
          accent="bg-indigo-100"
        />
        <KpiCard
          label="En espera"
          value={ticketStats.byEstado.en_espera}
          icon={<Hourglass size={18} className="text-amber-700" />}
          accent="bg-amber-100"
        />
        <KpiCard
          label="Cerrados"
          value={ticketStats.byEstado.cerrado}
          icon={<CheckCircle2 size={18} className="text-gray-700" />}
          accent="bg-gray-100"
        />
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Dispositivos</div>
      <div className="mb-6 flex flex-wrap gap-3">
        <KpiCard label="Total" value={deviceStats.total} icon={<Laptop size={18} className="text-gray-700" />} accent="bg-gray-100" />
        <KpiCard
          label="En línea"
          value={deviceStats.byEstado.online}
          icon={<Wifi size={18} className="text-green-700" />}
          accent="bg-green-100"
        />
        <KpiCard
          label="Fuera de línea"
          value={deviceStats.byEstado.offline}
          icon={<WifiOff size={18} className="text-gray-700" />}
          accent="bg-gray-100"
        />
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tendencias</div>
      <div className="flex flex-wrap gap-4">
        <ChartCard title="Tickets creados por día" subtitle="Últimos 14 días">
          {trend.every((t) => t.count === 0) ? (
            <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-gray-400">
              <p className="text-sm">Sin tickets nuevos en los últimos 14 días.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  interval={6}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  labelFormatter={shortDate}
                  formatter={(value: number) => [value, 'Tickets']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} fill="url(#trendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Tickets por estado">
          <div className="flex items-center gap-5">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={estadoSlices} dataKey="count" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={2}>
                  {estadoSlices.map((s) => (
                    <Cell key={s.estado} fill={s.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _name, item) => [value, item.payload.label]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5">
              {estadoSlices.map((s) => (
                <div key={s.estado} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  {s.label} · {s.count}
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Tickets por prioridad">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={prioridadBars} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={10}>
              <XAxis type="number" hide domain={[0, maxPrioridad]} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12, fill: '#4b5563' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip formatter={(value: number) => [value, 'Tickets']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                {prioridadBars.map((b) => (
                  <Cell key={b.prioridad} fill={PRIORIDAD_COLORS[b.prioridad]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
