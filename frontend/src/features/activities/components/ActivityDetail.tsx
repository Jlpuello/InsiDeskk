import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import { Building2, CalendarCheck, FileDown, Monitor, Send, Tag } from 'lucide-react';
import { activityApi } from '../api/activity.api.ts';
import { CreateActaModal } from './CreateActaModal.tsx';
import { CompleteActivityModal } from './CompleteActivityModal.tsx';
import { AuthenticatedImage } from '../../../shared/components/AuthenticatedImage.tsx';
import { AttachmentThumbnail } from '../../../shared/components/AttachmentThumbnail.tsx';
import { ImageLightbox } from '../../../shared/components/ImageLightbox.tsx';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
import { DocumentCard, DocumentSection, DocumentSignature } from '../../../shared/components/document/DocumentCard.tsx';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Activity, ActivityFollowup, ActivityStatus, ActivityType } from '../types/activity.types.ts';

const STATUS_LABELS: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const STATUS_STYLES: Record<ActivityStatus, string> = {
  pendiente: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-800',
};

const TYPE_LABELS: Record<ActivityType, string> = {
  mantenimiento: 'Mantenimiento',
  integracion: 'Integración',
  seguimiento: 'Seguimiento',
  otro: 'Otro',
};

// "Completar" no está acá — abre CompleteActivityModal en vez de cambiar el
// estado directo, porque exige indicar qué se hizo (ver
// ActivityService.changeStatus en el backend). "Pausar" (en_progreso →
// pendiente) tampoco cambia el estado directo — exige motivo, ver
// handlePauseActivity/showPauseModal más abajo.
const WORKFLOW_ACTIONS: Record<ActivityStatus, { estado: ActivityStatus; label: string; style: string }[]> = {
  pendiente: [
    { estado: 'en_progreso', label: 'Iniciar', style: 'bg-blue-600 text-white hover:bg-blue-700' },
    { estado: 'cancelada', label: 'Cancelar', style: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
  en_progreso: [
    { estado: 'pendiente', label: 'Pausar', style: 'bg-amber-500 text-white hover:bg-amber-600' },
    { estado: 'cancelada', label: 'Cancelar', style: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
  ],
  completada: [],
  cancelada: [],
};

const CAN_COMPLETE_FROM: ActivityStatus[] = ['en_progreso'];

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const rol = currentUser?.rol;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [followups, setFollowups] = useState<ActivityFollowup[]>([]);
  const [newFollowup, setNewFollowup] = useState('');
  const [showActaModal, setShowActaModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [sendingActa, setSendingActa] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  async function load(activityId: string) {
    const [activityData, followupsData] = await Promise.all([
      activityApi.getById(activityId),
      activityApi.listFollowups(activityId),
    ]);
    setActivity(activityData);
    setFollowups(followupsData);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    load(id)
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la actividad');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleStatusChange(estado: ActivityStatus) {
    if (!id) return;
    setSavingStatus(true);
    try {
      const updated = await activityApi.changeStatus(id, estado);
      setActivity(updated);
    } catch {
      setError('No se pudo cambiar el estado');
    } finally {
      setSavingStatus(false);
    }
  }

  // "Pausar" (→ pendiente) exige motivo (ver ActivityController#statusSchema)
  // — por eso no pasa por handleStatusChange directo, sino por MotivoModal.
  async function handlePauseActivity(motivo: string) {
    if (!id) return;
    const updated = await activityApi.changeStatus(id, 'pendiente', motivo);
    setActivity(updated);
    setShowPauseModal(false);
  }

  function handleCompleted(updated: Activity) {
    setActivity(updated);
    setShowCompleteModal(false);
  }

  async function handleAddFollowup(e: FormEvent) {
    e.preventDefault();
    if (!id || !newFollowup.trim()) return;
    setSavingFollowup(true);
    try {
      const followup = await activityApi.addFollowup(id, newFollowup.trim());
      setFollowups((prev) => [...prev, followup]);
      setNewFollowup('');
    } catch {
      setError('No se pudo agregar el seguimiento');
    } finally {
      setSavingFollowup(false);
    }
  }

  function handleActaCreated() {
    setShowActaModal(false);
    if (id) load(id).catch(() => {});
  }

  async function handleSendActa(e: FormEvent) {
    e.preventDefault();
    if (!id || !activity?.acta || !sendTo.trim()) return;
    setSendingActa(true);
    setError(null);
    try {
      await activityApi.sendActa(id, activity.acta.id, sendTo.trim());
      await load(id);
      setSendTo('');
    } catch {
      setError('No se pudo enviar el acta por correo — revisá que el envío de emails esté configurado');
    } finally {
      setSendingActa(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando actividad...</p>;
  if (error && !activity) return <p className="p-6 text-red-600">{error}</p>;
  if (!activity) return null;

  // Solo el técnico asignado (o admin) puede gestionar la actividad — si no
  // tiene a nadie asignado todavía, queda abierta a cualquier técnico (ver
  // ActivityService.assertCanManageActivity, mismo criterio en el backend).
  const canManage =
    rol === 'admin' ||
    (rol === 'tecnico' && (!activity.usuarioAsignadoId || activity.usuarioAsignadoId === currentUser?.id));

  const actions = canManage ? WORKFLOW_ACTIONS[activity.estado] : [];
  const canComplete = canManage && CAN_COMPLETE_FROM.includes(activity.estado);
  const canGenerateActa = canManage && activity.estado === 'completada' && !activity.acta;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/activities" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Volver a actividades
      </Link>

      {showActaModal && id && activity.resultado && (
        <CreateActaModal
          activityId={id}
          resultado={activity.resultado}
          onClose={() => setShowActaModal(false)}
          onCreated={handleActaCreated}
        />
      )}
      {showCompleteModal && id && (
        <CompleteActivityModal activityId={id} onClose={() => setShowCompleteModal(false)} onCompleted={handleCompleted} />
      )}
      {showPauseModal && (
        <MotivoModal
          title="Pausar actividad"
          subtitle={activity.titulo}
          confirmLabel="Pausar"
          confirmClassName="bg-amber-500 hover:bg-amber-600"
          templateContext="motivo_pausa"
          onClose={() => setShowPauseModal(false)}
          onConfirm={handlePauseActivity}
        />
      )}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">{activity.titulo}</h1>
          <span className={clsx('shrink-0 rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLES[activity.estado])}>
            {STATUS_LABELS[activity.estado]}
          </span>
        </div>
        {activity.descripcion && <p className="mb-4 text-sm text-gray-600">{activity.descripcion}</p>}

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-400">Tipo</dt>
            <dd className="text-gray-800">{TYPE_LABELS[activity.tipo]}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Empresa</dt>
            <dd className="text-gray-800">{activity.empresa?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Asignado a</dt>
            <dd className="text-gray-800">{activity.usuarioAsignado?.nombre ?? 'Sin asignar'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Dispositivo</dt>
            <dd className="text-gray-800">{activity.dispositivo?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Ticket relacionado</dt>
            <dd className="text-gray-800">
              {activity.ticket ? (
                <Link to={`/tickets/${activity.ticket.id}`} className="text-blue-600 hover:underline">
                  {activity.ticket.titulo}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">Fecha planeada</dt>
            <dd className="text-gray-800">
              {activity.fechaPlaneada ? new Date(activity.fechaPlaneada).toLocaleDateString('es-ES') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">Completada</dt>
            <dd className="text-gray-800">
              {activity.fechaCompletada ? new Date(activity.fechaCompletada).toLocaleString('es-ES') : '—'}
            </dd>
          </div>
          {activity.plantilla && (
            <div>
              <dt className="text-gray-400">Generada por</dt>
              <dd className="text-gray-800">{activity.plantilla.titulo}</dd>
            </div>
          )}
        </dl>

        {activity.resultado && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium uppercase text-gray-400">Qué se realizó</p>
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{activity.resultado}</p>
            {activity.resultadoAdjuntos && activity.resultadoAdjuntos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {activity.resultadoAdjuntos.map((url) => (
                  <AttachmentThumbnail
                    key={url}
                    url={url}
                    alt="Evidencia"
                    onImageClick={() => setLightboxUrl(url)}
                    className="h-24 w-24 rounded-md border border-gray-200 object-cover transition hover:opacity-80"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!canManage && rol === 'tecnico' && activity.estado !== 'completada' && activity.estado !== 'cancelada' && (
          <p className="mb-2 text-xs text-gray-400">Solo el técnico asignado puede gestionar esta actividad.</p>
        )}

        {(actions.length > 0 || canComplete || canGenerateActa) && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">Acciones</p>
            <div className="flex flex-wrap gap-2">
              {canComplete && (
                <button
                  disabled={savingStatus}
                  onClick={() => setShowCompleteModal(true)}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Completar
                </button>
              )}
              {actions.map((action) => (
                <button
                  key={action.estado}
                  disabled={savingStatus}
                  onClick={() => (action.estado === 'pendiente' ? setShowPauseModal(true) : handleStatusChange(action.estado))}
                  className={clsx(
                    'rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
                    action.style,
                  )}
                >
                  {action.label}
                </button>
              ))}
              {canGenerateActa && (
                <button
                  onClick={() => setShowActaModal(true)}
                  className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <FileDown size={14} />
                  Generar acta de entrega
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {activity.acta && (
        <DocumentCard
          className="mb-6"
          eyebrow="Acta de entrega"
          title={activity.titulo}
          reference={`ACT-${activity.acta.id.slice(0, 8).toUpperCase()}`}
          status={{ label: 'Firmada', tone: 'good' }}
          fields={[
            { label: 'Empresa', value: activity.empresa?.nombre ?? '—', icon: <Building2 size={14} /> },
            { label: 'Tipo', value: TYPE_LABELS[activity.tipo], icon: <Tag size={14} /> },
            { label: 'Dispositivo', value: activity.dispositivo?.nombre ?? '—', icon: <Monitor size={14} /> },
            {
              label: 'Completada',
              value: activity.fechaCompletada ? new Date(activity.fechaCompletada).toLocaleDateString('es-ES') : '—',
              icon: <CalendarCheck size={14} />,
            },
          ]}
          footerLeft={activity.acta.enviadoEn ? `Enviada a ${activity.acta.enviadoA}` : undefined}
          footerRight={activity.acta.enviadoEn ? new Date(activity.acta.enviadoEn).toLocaleString('es-ES') : undefined}
        >
          <DocumentSection label="Trabajo realizado">{activity.acta.contenido}</DocumentSection>

          <DocumentSignature
            name={activity.acta.firmaNombre}
            role="Firmó la entrega"
            date={new Date(activity.acta.firmadoEn).toLocaleString('es-ES')}
            action={
              <button
                type="button"
                onClick={() => activityApi.downloadActaPdf(activity.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <FileDown size={14} />
                Descargar PDF
              </button>
            }
          >
            <AuthenticatedImage
              src={activity.acta.firmaImagen}
              alt="Firma"
              className="h-14 w-32 rounded-md border border-gray-200 bg-white object-contain"
            />
          </DocumentSignature>

          {canManage && (
            <form onSubmit={handleSendActa} className="flex gap-2">
              <input
                type="email"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="Email del destinatario"
                required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingActa || !sendTo.trim()}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={14} />
                {sendingActa ? 'Enviando...' : activity.acta.enviadoEn ? 'Reenviar' : 'Enviar por correo'}
              </button>
            </form>
          )}
        </DocumentCard>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Seguimientos</h2>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {followups.length === 0 ? (
          <p className="mb-4 text-sm text-gray-500">Sin seguimientos todavía.</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {followups.map((followup) => (
              <li key={followup.id} className="rounded-md bg-gray-50 p-3 text-sm">
                <p className="text-gray-800">{followup.contenido}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {followup.usuario?.nombre ?? 'Usuario'} · {new Date(followup.createdAt).toLocaleString('es-ES')}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <form onSubmit={handleAddFollowup} className="flex gap-2">
            <input
              type="text"
              value={newFollowup}
              onChange={(e) => setNewFollowup(e.target.value)}
              placeholder="Agregar un seguimiento..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingFollowup || !newFollowup.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </form>
        )}
      </div>

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Evidencia" onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
