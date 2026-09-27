import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import clsx from 'clsx';
import { Building2, Clock, FileDown, Tag, Trash2, User, X } from 'lucide-react';
import { ticketApi } from '../api/ticket.api.ts';
import { getSlaBadge } from '../utils/sla.ts';
import { formatDuration } from '../utils/time.ts';
import { userApi } from '../../users/api/user.api.ts';
import type { UserSummary } from '../../users/types/user.types.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { hasPermission } from '../../../shared/security/permissions.ts';
import { CloseTicketModal } from './CloseTicketModal.tsx';
import { ReopenTicketModal } from './ReopenTicketModal.tsx';
import { AttachmentThumbnail } from '../../../shared/components/AttachmentThumbnail.tsx';
import { DocumentCard, DocumentLabel, DocumentSection } from '../../../shared/components/document/DocumentCard.tsx';
import { ImageLightbox } from '../../../shared/components/ImageLightbox.tsx';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
// Única excepción al criterio de imports cruzados de una sola dirección
// (quotes ya depende de tickets del lado del backend) — una cotización es
// una extensión del detalle del ticket, igual que las notas, así que se
// embebe directo acá en vez de vivir en una pantalla propia. quotes no
// importa nada de tickets del lado del frontend, así que no hay ciclo.
import { QuoteSection } from '../../quotes/components/QuoteSection.tsx';
import type { NoteType, Ticket, TicketNote, TicketStatus } from '../types/ticket.types.ts';

const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  esperando_aprobacion: 'Esperando aprobación',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  en_espera: 'bg-purple-100 text-purple-800',
  esperando_aprobacion: 'bg-orange-100 text-orange-800',
  cerrado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  interna: 'Nota interna',
  cliente: 'Respuesta al cliente',
  sistema: 'Sistema',
  cierre: 'Cierre del ticket',
  reapertura: 'Reapertura',
};

// Botones de flujo por estado actual — en vez de un selector libre de
// cualquier estado a cualquier otro, esto guía el ciclo de vida real de un
// ticket (Iniciar → Pausar/Reanudar → Cerrar) y es lo que dispara el cálculo
// de tiempo trabajado en el backend (TicketService.changeTicketStatus).
// "cerrado" NO está acá: cerrar requiere documentar la solución (ver
// CloseTicketModal) y solo se ofrece desde en_progreso/en_espera — un
// ticket "abierto" que nunca se inició no se puede cerrar directo.
const WORKFLOW_ACTIONS: Record<TicketStatus, { estado: TicketStatus; label: string; style: string }[]> = {
  abierto: [
    { estado: 'en_progreso', label: 'Iniciar trabajo', style: 'bg-blue-600 text-white hover:bg-blue-700' },
    { estado: 'cancelado', label: 'Cancelar', style: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
  en_progreso: [
    { estado: 'en_espera', label: 'Pausar', style: 'bg-amber-500 text-white hover:bg-amber-600' },
    { estado: 'cancelado', label: 'Cancelar', style: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
  en_espera: [
    { estado: 'en_progreso', label: 'Reanudar', style: 'bg-blue-600 text-white hover:bg-blue-700' },
    { estado: 'cancelado', label: 'Cancelar', style: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
  // Vacío a propósito: mientras espera aprobación, el único cambio de estado
  // válido es que se resuelva la cotización o se cancele la solicitud (ver
  // QuoteSection) — no un botón de flujo genérico.
  esperando_aprobacion: [],
  cerrado: [],
  cancelado: [],
};

const CAN_CLOSE_FROM: TicketStatus[] = ['en_progreso', 'en_espera'];

function SlaBadge({
  label,
  dueAt,
  completedAt,
  paused,
}: {
  label: string;
  dueAt?: string | null;
  completedAt?: string | null;
  // Mientras el ticket espera aprobación de una cotización, el reloj no
  // corre (ver Ticket.slaPausadoEn) — mostrar la cuenta regresiva igual
  // sugeriría que sigue corriendo, así que se reemplaza por un badge neutro.
  paused?: boolean;
}) {
  if (paused) {
    return (
      <div>
        <dt className="text-gray-400">{label}</dt>
        <dd>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
            Pausado (esperando aprobación)
          </span>
        </dd>
      </div>
    );
  }

  const badge = getSlaBadge(dueAt, completedAt);
  if (!badge) return null;
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd>
        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>{badge.label}</span>
      </dd>
    </div>
  );
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const rol = user?.rol;
  const canManageWorkflow = rol === 'admin' || rol === 'tecnico';
  // El reporte imprimible reusa el mismo GET que ya usa esta pantalla — no
  // hay un límite duro de backend posible sin una ruta propia (el cliente ya
  // ve estos datos acá). Para cliente, es un gate solo de conveniencia de
  // frontend; staff siempre lo ve.
  const canExportReport = canManageWorkflow || hasPermission(user, 'documents:export');

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('interna');
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  async function loadTicket(ticketId: string) {
    const [ticketData, notesData] = await Promise.all([
      ticketApi.getById(ticketId),
      ticketApi.listNotes(ticketId),
    ]);
    setTicket(ticketData);
    setNotes(notesData);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    loadTicket(id)
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

  // El draft se resincroniza cada vez que el ticket trae un nuevo valor real
  // (carga inicial, o después de guardar) — así el select puede tener un
  // cambio sin confirmar sin que se pierda al re-renderizar por otra causa.
  useEffect(() => {
    setAssigneeDraft(ticket?.usuarioAsignadoId ?? '');
  }, [ticket?.usuarioAsignadoId]);

  useEffect(() => {
    if (!canManageWorkflow || !ticket?.empresaId) return;
    userApi
      .list(ticket.empresaId)
      .then((users) => setTechnicians(users.filter((u) => u.activo && u.rol !== 'cliente')))
      .catch(() => setTechnicians([]));
  }, [canManageWorkflow, ticket?.empresaId]);

  async function handleStatusChange(estado: TicketStatus) {
    if (!id || !ticket) return;
    setSavingStatus(true);
    try {
      const updated = await ticketApi.changeStatus(id, estado);
      setTicket(updated);
    } catch {
      setError('No se pudo cambiar el estado');
    } finally {
      setSavingStatus(false);
    }
  }

  // "Pausar" (→ en_espera) es la única transición de flujo que exige motivo
  // (ver TicketController#statusSchema) — por eso no pasa por
  // handleStatusChange directo, sino por MotivoModal (showPauseModal, abajo).
  async function handlePauseTicket(motivo: string) {
    if (!id) return;
    const updated = await ticketApi.changeStatus(id, 'en_espera', motivo);
    setTicket(updated);
    setShowPauseModal(false);
  }

  async function handleSaveAssignee() {
    if (!id) return;
    setSavingAssignee(true);
    try {
      const updated = await ticketApi.update(id, { usuarioAsignadoId: assigneeDraft || null });
      setTicket(updated);
    } catch {
      setError('No se pudo asignar el ticket');
    } finally {
      setSavingAssignee(false);
    }
  }

  function handleTicketClosed(updated: Ticket) {
    setTicket(updated);
    setShowCloseModal(false);
    if (id) ticketApi.listNotes(id).then(setNotes).catch(() => {});
  }

  function handleTicketReopened(updated: Ticket) {
    setTicket(updated);
    setShowReopenModal(false);
    if (id) ticketApi.listNotes(id).then(setNotes).catch(() => {});
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!id || !newNote.trim()) return;

    setSavingNote(true);
    try {
      const note = await ticketApi.addNote(id, newNote.trim(), noteType);
      setNotes((prev) => [...prev, note]);
      setNewNote('');
      // Si era la primera respuesta al cliente, el backend ya marcó
      // primeraRespuestaEn — refrescamos el ticket para que el badge de SLA
      // de respuesta se actualice sin recargar la página.
      if (noteType === 'cliente') {
        ticketApi.getById(id).then(setTicket).catch(() => {});
      }
    } catch {
      setError('No se pudo agregar la nota');
    } finally {
      setSavingNote(false);
    }
  }

  async function handleRemoveNote(noteId: string) {
    if (!id) return;
    setDeletingNoteId(noteId);
    try {
      await ticketApi.removeNote(id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setError('No se pudo borrar la nota');
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleDeleteTicket(motivo: string) {
    if (!id) return;
    await ticketApi.remove(id, motivo);
    navigate('/tickets');
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando ticket...</p>;
  if (error && !ticket) return <p className="p-6 text-red-600">{error}</p>;
  if (!ticket) return null;

  const isClosed = ticket.estado === 'cerrado';
  // Bloqueado para edición normal (asignación, notas, cambios de estado) —
  // mismo criterio que un ticket cerrado, ver TicketService.assertNotLocked
  // en el backend. La única salida es resolver/cancelar la cotización, ver
  // QuoteSection más abajo.
  const isLocked = isClosed || ticket.estado === 'esperando_aprobacion';
  const actions = canManageWorkflow ? WORKFLOW_ACTIONS[ticket.estado] : [];
  const canClose = canManageWorkflow && CAN_CLOSE_FROM.includes(ticket.estado);
  const assigneeDirty = assigneeDraft !== (ticket.usuarioAsignadoId ?? '');

  // La nota de cierre más reciente (puede haber más de una si el ticket se
  // reabrió y se volvió a cerrar) — se destaca arriba con DocumentCard sin
  // sacarla de la lista general de notas, donde sigue apareciendo igual que
  // siempre para no perder el historial completo.
  const closureNote = [...notes].reverse().find((n) => n.tipo === 'cierre');

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/tickets" className="inline-block text-sm text-blue-600 hover:underline">
          ← Volver a tickets
        </Link>
        {(isClosed || canManageWorkflow) && (
          <div className="flex items-center gap-2">
            {isClosed && canExportReport && (
              <Link
                to={`/tickets/${ticket.id}/report`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileDown size={14} />
                Exportar informe
              </Link>
            )}
            {isClosed && canManageWorkflow && (
              <button
                onClick={() => setShowReopenModal(true)}
                className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
              >
                Reabrir
              </button>
            )}
            {canManageWorkflow && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {showCloseModal && id && (
        <CloseTicketModal ticketId={id} onClose={() => setShowCloseModal(false)} onClosed={handleTicketClosed} />
      )}
      {showReopenModal && id && (
        <ReopenTicketModal ticketId={id} onClose={() => setShowReopenModal(false)} onReopened={handleTicketReopened} />
      )}
      {showDeleteModal && (
        <MotivoModal
          title="Eliminar ticket"
          subtitle={ticket.titulo}
          confirmLabel="Eliminar"
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteTicket}
        />
      )}
      {showPauseModal && (
        <MotivoModal
          title="Pausar ticket"
          subtitle={ticket.titulo}
          confirmLabel="Pausar"
          confirmClassName="bg-amber-500 hover:bg-amber-600"
          templateContext="motivo_pausa"
          onClose={() => setShowPauseModal(false)}
          onConfirm={handlePauseTicket}
        />
      )}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">{ticket.titulo}</h1>
          <span className={clsx('shrink-0 rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLES[ticket.estado])}>
            {STATUS_LABELS[ticket.estado]}
          </span>
        </div>
        <p className="mb-4 text-sm text-gray-600">{ticket.descripcion}</p>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-400">Prioridad</dt>
            <dd className="capitalize text-gray-800">{ticket.prioridad}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Criticidad</dt>
            <dd className="capitalize text-gray-800">{ticket.criticidad}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Reportado por</dt>
            <dd className="text-gray-800">
              {ticket.usuarioReporter?.nombre ?? ticket.reporterNombre ?? '—'}
              {!ticket.usuarioReporterId && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  Público
                </span>
              )}
              {!ticket.usuarioReporterId && (ticket.reporterEmail || ticket.reporterTelefono) && (
                <span className="block text-xs text-gray-400">
                  {[ticket.reporterEmail, ticket.reporterTelefono].filter(Boolean).join(' · ')}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">Categoría</dt>
            <dd className="text-gray-800">{ticket.categoria?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Subcategoría</dt>
            <dd className="text-gray-800">{ticket.subcategoria?.nombre ?? '—'}</dd>
          </div>
          <SlaBadge
            label="SLA respuesta"
            dueAt={ticket.slaRespuestaVence}
            completedAt={ticket.primeraRespuestaEn}
            paused={!!ticket.slaPausadoEn && !ticket.primeraRespuestaEn}
          />
          <SlaBadge
            label="SLA resolución"
            dueAt={ticket.slaResolucionVence}
            completedAt={ticket.estado === 'cerrado' ? ticket.closedAt : null}
            paused={!!ticket.slaPausadoEn}
          />
          <div>
            <dt className="text-gray-400">Tiempo trabajado</dt>
            <dd className="text-gray-800">
              {formatDuration(ticket.tiempoReal)}
              {ticket.trabajoIniciadoEn && <span className="ml-1 text-xs text-amber-600">(en curso)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">Asignado a</dt>
            <dd className="text-gray-800">
              {canManageWorkflow && !isLocked ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <select
                    value={assigneeDraft}
                    onChange={(e) => setAssigneeDraft(e.target.value)}
                    disabled={savingAssignee}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                  {assigneeDirty && (
                    <button
                      onClick={handleSaveAssignee}
                      disabled={savingAssignee}
                      className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingAssignee ? '...' : 'Guardar'}
                    </button>
                  )}
                </div>
              ) : (
                (ticket.usuarioAsignado?.nombre ?? '—')
              )}
            </dd>
          </div>
        </dl>

        {(actions.length > 0 || canClose) && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">Acciones</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.estado}
                  disabled={savingStatus}
                  onClick={() => (action.estado === 'en_espera' ? setShowPauseModal(true) : handleStatusChange(action.estado))}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
                    action.style,
                  )}
                >
                  {action.label}
                </button>
              ))}
              {canClose && (
                <button
                  disabled={savingStatus}
                  onClick={() => setShowCloseModal(true)}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {ticket.estado === 'cerrado' && closureNote && (
        <DocumentCard
          className="mb-6"
          eyebrow="Cierre de ticket"
          title={ticket.titulo}
          reference={`TCK-${ticket.id.slice(0, 8).toUpperCase()}`}
          status={{ label: 'Resuelto', tone: 'good' }}
          fields={[
            { label: 'Empresa', value: ticket.empresa?.nombre ?? '—', icon: <Building2 size={14} /> },
            {
              label: 'Técnico',
              value: closureNote.usuario?.nombre ?? ticket.usuarioAsignado?.nombre ?? '—',
              icon: <User size={14} />,
            },
            {
              label: 'Categoría',
              value: ticket.categoria ? `${ticket.categoria.nombre}${ticket.subcategoria ? ` · ${ticket.subcategoria.nombre}` : ''}` : '—',
              icon: <Tag size={14} />,
            },
            { label: 'Tiempo trabajado', value: formatDuration(ticket.tiempoReal), icon: <Clock size={14} /> },
          ]}
          footerLeft={`Cerrado por ${closureNote.usuario?.nombre ?? 'Usuario'}`}
          footerRight={new Date(closureNote.createdAt).toLocaleString('es-ES')}
        >
          <DocumentSection label="Resolución">{closureNote.contenido}</DocumentSection>
          {closureNote.adjuntos && closureNote.adjuntos.length > 0 && (
            <div>
              <DocumentLabel>Evidencia</DocumentLabel>
              <div className="flex flex-wrap gap-2">
                {closureNote.adjuntos.map((url) => (
                  <AttachmentThumbnail
                    key={url}
                    url={url}
                    alt="Evidencia de cierre"
                    onImageClick={() => setLightboxUrl(url)}
                    className="h-20 w-20 rounded-md border border-gray-200 object-cover transition hover:opacity-80"
                  />
                ))}
              </div>
            </div>
          )}
        </DocumentCard>
      )}

      <QuoteSection ticketId={ticket.id} empresaId={ticket.empresaId} />

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Notas</h2>

        {notes.length === 0 ? (
          <p className="mb-4 text-sm text-gray-500">Sin notas todavía.</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md bg-gray-50 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-gray-800">{note.contenido}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {note.tipo !== 'interna' && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {NOTE_TYPE_LABELS[note.tipo]}
                      </span>
                    )}
                    {canManageWorkflow && (note.tipo === 'interna' || note.tipo === 'cliente') && (
                      <button
                        type="button"
                        onClick={() => handleRemoveNote(note.id)}
                        disabled={deletingNoteId === note.id}
                        aria-label="Borrar nota"
                        className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {note.adjuntos && note.adjuntos.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-2">
                    {note.adjuntos.map((url) => (
                      <AttachmentThumbnail
                        key={url}
                        url={url}
                        alt="Evidencia de cierre"
                        onImageClick={() => setLightboxUrl(url)}
                        className="h-24 w-24 rounded-md border border-gray-200 object-cover transition hover:opacity-80"
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {note.usuario?.nombre ?? 'Usuario'} · {new Date(note.createdAt).toLocaleString('es-ES')}
                </p>
              </li>
            ))}
          </ul>
        )}

        {isLocked ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {isClosed
              ? 'Este ticket está cerrado — reabrilo para poder agregar notas.'
              : 'Este ticket está esperando la aprobación de una cotización — no se pueden agregar notas hasta que se resuelva.'}
          </p>
        ) : (
          <form onSubmit={handleAddNote} className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Tipo</label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="interna">Nota interna</option>
                <option value="cliente">Respuesta al cliente</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Agregar una nota..."
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingNote || !newNote.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </form>
        )}
      </div>

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Evidencia de cierre" onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
