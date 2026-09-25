import { useEffect, useState, type FormEvent } from 'react';
import { Laptop, Tag, User } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../../../shared/components/Modal.tsx';
import { ticketApi } from '../api/ticket.api.ts';
import { deviceApi } from '../../devices/api/device.api.ts';
import type { Device } from '../../devices/types/device.types.ts';
import type { Ticket, TicketCategory, TicketCriticidad, TicketPriority } from '../types/ticket.types.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';

const PRIORITY_OPTIONS: TicketPriority[] = ['baja', 'media', 'alta', 'critica'];
const CRITICIDAD_OPTIONS: TicketCriticidad[] = ['baja', 'media', 'alta', 'critica'];

// Mismo lenguaje de color en toda la app para "qué tan grave es esto"
// (severidad de baja a crítica) — acá se usa como un punto de color al lado
// del select, para que la urgencia se perciba de un vistazo sin tener que
// leer el texto.
const SEVERITY_DOT: Record<TicketPriority | TicketCriticidad, string> = {
  baja: 'bg-slate-400',
  media: 'bg-blue-500',
  alta: 'bg-amber-500',
  critica: 'bg-red-500',
};

const selectClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';

interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

export function CreateTicketModal({ onClose, onCreated }: CreateTicketModalProps) {
  const empresaId = useAuthStore((state) => state.user?.empresaId);
  const rol = useAuthStore((state) => state.user?.rol);
  // Un cliente reportando su propio ticket YA es el reportante (su cuenta) —
  // esta sección es para cuando un admin/técnico registra el ticket de
  // alguien que llamó o escribió, sin cuenta propia en el sistema.
  const canLogReporter = rol === 'admin' || rol === 'tecnico';

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<TicketPriority>('media');
  const [criticidad, setCriticidad] = useState<TicketCriticidad>('media');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [dispositivoId, setDispositivoId] = useState('');
  const [reporterNombre, setReporterNombre] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterTelefono, setReporterTelefono] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    deviceApi.list().then(setDevices).catch(() => setDevices([]));
    ticketApi
      .listCategories()
      .then((cats) => setCategories(cats.filter((c) => c.activo)))
      .catch(() => setCategories([]));
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoriaId);
  const subcategoryOptions = (selectedCategory?.subcategorias ?? []).filter((s) => s.activo);
  const selectedSubcategory = subcategoryOptions.find((s) => s.id === subcategoriaId);

  // La subcategoría gana sobre la categoría cuando ambas fijan un valor —
  // igual regla que TicketCategoryService.resolveDefaults en el backend.
  // Si esto define un valor, el backend lo va a imponer igual aunque el
  // formulario mande otra cosa, así que acá se refleja como fijo (no
  // editable) para no mostrar una opción que en la práctica no aplica.
  const fixedPrioridad = selectedSubcategory?.prioridadDefault ?? selectedCategory?.prioridadDefault ?? null;
  const fixedCriticidad = selectedSubcategory?.criticidadDefault ?? selectedCategory?.criticidadDefault ?? null;

  useEffect(() => {
    if (fixedPrioridad) setPrioridad(fixedPrioridad);
  }, [fixedPrioridad]);

  useEffect(() => {
    if (fixedCriticidad) setCriticidad(fixedCriticidad);
  }, [fixedCriticidad]);

  function handleCategoriaChange(value: string) {
    setCategoriaId(value);
    setSubcategoriaId(''); // cambiar de categoría invalida la subcategoría elegida antes
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!empresaId) {
      setError('Tu usuario no tiene una empresa asociada');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ticket = await ticketApi.create({
        titulo,
        descripcion: descripcion || undefined,
        empresaId,
        prioridad,
        criticidad,
        categoriaId: categoriaId || undefined,
        subcategoriaId: subcategoriaId || undefined,
        dispositivoId: dispositivoId || undefined,
        reporterNombre: reporterNombre || undefined,
        reporterEmail: reporterEmail || undefined,
        reporterTelefono: reporterTelefono || undefined,
      });
      onCreated(ticket);
    } catch {
      setError('No se pudo crear el ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo ticket" subtitle="Registrá una nueva solicitud de soporte" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div>
            <label className={labelClasses}>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              minLength={3}
              placeholder="Resumen breve del problema"
              className={selectClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Detalle de lo que está pasando, pasos para reproducirlo..."
              className={selectClasses}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Tag size={14} />
            Clasificación
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => handleCategoriaChange(e.target.value)}
                className={clsx(selectClasses, 'bg-white')}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Subcategoría</label>
              <select
                value={subcategoriaId}
                onChange={(e) => setSubcategoriaId(e.target.value)}
                disabled={subcategoryOptions.length === 0}
                className={clsx(selectClasses, 'bg-white')}
              >
                <option value="">Ninguna</option>
                {subcategoryOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>
                Prioridad {fixedPrioridad && <span className="font-normal text-gray-400">(fija por categoría)</span>}
              </label>
              <div className="relative">
                <span
                  className={clsx(
                    'pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full',
                    SEVERITY_DOT[prioridad],
                  )}
                />
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as TicketPriority)}
                  disabled={!!fixedPrioridad}
                  className={clsx(selectClasses, 'bg-white pl-6 capitalize')}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClasses}>
                Criticidad{' '}
                {fixedCriticidad && <span className="font-normal text-gray-400">(fija por categoría)</span>}
              </label>
              <div className="relative">
                <span
                  className={clsx(
                    'pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full',
                    SEVERITY_DOT[criticidad],
                  )}
                />
                <select
                  value={criticidad}
                  onChange={(e) => setCriticidad(e.target.value as TicketCriticidad)}
                  disabled={!!fixedCriticidad}
                  className={clsx(selectClasses, 'bg-white pl-6 capitalize')}
                >
                  {CRITICIDAD_OPTIONS.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className={clsx(labelClasses, 'flex items-center gap-1.5')}>
            <Laptop size={14} className="text-gray-400" />
            Dispositivo
          </label>
          <select
            value={dispositivoId}
            onChange={(e) => setDispositivoId(e.target.value)}
            className={selectClasses}
          >
            <option value="">Ninguno</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.nombre}
              </option>
            ))}
          </select>
        </div>

        {canLogReporter && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <User size={14} />
              Reportado por <span className="font-normal normal-case text-gray-400">(opcional, si no es tu caso)</span>
            </div>
            <div>
              <label className={labelClasses}>Nombre</label>
              <input
                type="text"
                value={reporterNombre}
                onChange={(e) => setReporterNombre(e.target.value)}
                placeholder="Quién llamó o escribió reportando esto"
                className={clsx(selectClasses, 'bg-white')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  className={clsx(selectClasses, 'bg-white')}
                />
              </div>
              <div>
                <label className={labelClasses}>Teléfono</label>
                <input
                  type="tel"
                  value={reporterTelefono}
                  onChange={(e) => setReporterTelefono(e.target.value)}
                  className={clsx(selectClasses, 'bg-white')}
                />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || titulo.trim().length < 3}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
