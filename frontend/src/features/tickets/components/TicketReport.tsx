import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { ticketApi } from '../api/ticket.api.ts';
import { getSlaBadge } from '../utils/sla.ts';
import { formatDuration } from '../utils/time.ts';
import { AuthenticatedImage } from '../../../shared/components/AuthenticatedImage.tsx';
import { DocumentHeader, type DocumentStatusTone } from '../../../shared/components/document/DocumentCard.tsx';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { hasPermission } from '../../../shared/security/permissions.ts';
import type { NoteType, Ticket, TicketNote } from '../types/ticket.types.ts';

const STATUS_TONES: Record<string, DocumentStatusTone> = {
  abierto: 'neutral',
  en_progreso: 'neutral',
  en_espera: 'warn',
  esperando_aprobacion: 'warn',
  cerrado: 'good',
  cancelado: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  esperando_aprobacion: 'Esperando aprobación',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  interna: 'Nota interna',
  cliente: 'Respuesta al cliente',
  sistema: 'Sistema',
  cierre: 'Cierre del ticket',
  reapertura: 'Reapertura',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// Vista standalone (fuera de AppLayout, sin sidebar) pensada para imprimir o
// "Guardar como PDF" desde el diálogo de impresión del navegador — evita
// depender de una librería de generación de PDF en el backend para un
// reporte que no necesita más que texto + tablas bien maquetadas.
export function TicketReport() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const isStaff = user?.rol === 'admin' || user?.rol === 'tecnico';
  const canExport = isStaff || hasPermission(user, 'documents:export');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([ticketApi.getById(id), ticketApi.listNotes(id)])
      .then(([ticketData, notesData]) => {
        if (cancelled) return;
        setTicket(ticketData);
        // El informe es exportable por el cliente dueño del ticket, así que
        // no incluye notas internas del equipo técnico — solo lo que ya es
        // visible para el cliente (respuestas) o generado por el sistema.
        setNotes(notesData.filter((n) => n.tipo !== 'interna'));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el ticket');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!canExport) return <p className="p-6 text-red-600">No tenés permiso para exportar este informe.</p>;
  if (loading) return <p className="p-6 text-gray-500">Cargando informe...</p>;
  if (error || !ticket) return <p className="p-6 text-red-600">{error ?? 'Ticket no encontrado'}</p>;

  const respuestaBadge = getSlaBadge(ticket.slaRespuestaVence, ticket.primeraRespuestaEn);
  const resolucionBadge = getSlaBadge(
    ticket.slaResolucionVence,
    ticket.estado === 'cerrado' ? ticket.closedAt : null,
  );
  const tiempoTotal =
    ticket.closedAt && ticket.createdAt
      ? formatDuration(Math.round((new Date(ticket.closedAt).getTime() - new Date(ticket.createdAt).getTime()) / 60_000))
      : '—';

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-xs text-gray-400">Informe de ticket — vista de impresión</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer size={16} />
          Imprimir / Guardar PDF
        </button>
      </div>

      <DocumentHeader
        className="mb-6 rounded-xl"
        eyebrow="Informe de ticket"
        title={ticket.titulo}
        reference={`TCK-${ticket.id.slice(0, 8).toUpperCase()}`}
        status={{ label: STATUS_LABELS[ticket.estado], tone: STATUS_TONES[ticket.estado] ?? 'neutral' }}
      />
      <p className="-mt-4 mb-6 text-xs text-gray-400">Generado el {new Date().toLocaleString('es-ES')}</p>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Empresa" value={ticket.empresa?.nombre ?? '—'} />
        <Field
          label="Reportado por"
          value={
            ticket.usuarioReporter?.nombre ??
            (ticket.reporterNombre ? `${ticket.reporterNombre} (público)` : '—')
          }
        />
        <Field label="Asignado a" value={ticket.usuarioAsignado?.nombre ?? 'Sin asignar'} />
        <Field label="Cerrado por" value={ticket.resuelto?.nombre ?? '—'} />
        <Field label="Categoría" value={ticket.categoria?.nombre ?? '—'} />
        <Field label="Subcategoría" value={ticket.subcategoria?.nombre ?? '—'} />
        <Field label="Prioridad" value={ticket.prioridad} />
        <Field label="Criticidad" value={ticket.criticidad} />
        <Field label="Dispositivo" value={ticket.dispositivo?.nombre ?? '—'} />
        <Field label="Abierto" value={new Date(ticket.createdAt).toLocaleString('es-ES')} />
        <Field label="Cerrado" value={ticket.closedAt ? new Date(ticket.closedAt).toLocaleString('es-ES') : '—'} />
        <Field label="Tiempo total (apertura→cierre)" value={tiempoTotal} />
        <Field label="Tiempo trabajado" value={formatDuration(ticket.tiempoReal)} />
        <Field label="SLA respuesta" value={respuestaBadge?.label ?? '—'} />
        <Field label="SLA resolución" value={resolucionBadge?.label ?? '—'} />
      </dl>

      <div className="mb-6">
        <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Descripción</p>
        <p className="whitespace-pre-wrap text-sm text-gray-800">{ticket.descripcion || 'Sin descripción.'}</p>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Seguimientos</p>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-500">Sin seguimientos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border border-gray-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-gray-800">{note.contenido}</p>
                  <span className="ml-2 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {NOTE_TYPE_LABELS[note.tipo]}
                  </span>
                </div>
                {note.adjuntos && note.adjuntos.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-3">
                    {note.adjuntos.map((url) => (
                      <AuthenticatedImage
                        key={url}
                        src={url}
                        alt="Evidencia de cierre"
                        className="max-h-72 max-w-full rounded-md border border-gray-200 object-contain print:max-h-96"
                      />
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {note.usuario?.nombre ?? 'Usuario'} · {new Date(note.createdAt).toLocaleString('es-ES')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
