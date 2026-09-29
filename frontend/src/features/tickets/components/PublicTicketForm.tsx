import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { publicTicketApi } from '../api/public-ticket.api.ts';
import { PublicGradientBackdrop } from '../../../shared/components/PublicGradientBackdrop.tsx';
import { useSeoMeta } from '../../../shared/hooks/useSeoMeta.ts';
import type { PublicTicketCategory } from '../types/ticket.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';

// Formulario sin login para compartir por link a alguien que no tiene cuenta
// en el sistema — identifica la empresa por NIT (ver public-ticket.api.ts)
// antes de dejar cargar el resto del ticket. A propósito SOLO para empresas
// ya registradas: si el NIT no matchea, no hay forma de seguir cargando el
// ticket desde acá — se deriva a /soporte (el bot), que sí sabe manejar
// "NIT no encontrado" y "sin NIT" con la verificación de seguridad
// correspondiente (ver FloatingSupportWidget.tsx / public-ticket.controller.ts).
type Stage = 'nit' | 'no-encontrada' | 'form';

export function PublicTicketForm() {
  const [stage, setStage] = useState<Stage>('nit');
  const [nit, setNit] = useState('');
  const [company, setCompany] = useState<{ id: string; nombre: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [categories, setCategories] = useState<PublicTicketCategory[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [reporterNombre, setReporterNombre] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterTelefono, setReporterTelefono] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useSeoMeta({
    fallbackTitle: 'Reportar un problema · InsiDesk',
    fallbackDescription: 'Reportá un problema técnico sin necesidad de cuenta — dejanos tus datos de contacto.',
  });

  useEffect(() => {
    if (stage !== 'form') return;
    publicTicketApi.listCategories().then(setCategories).catch(() => setCategories([]));
  }, [stage]);

  const subcategoryOptions = categories.find((c) => c.id === categoriaId)?.subcategorias ?? [];

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await publicTicketApi.verifyCompany(nit.trim());
      if (result.encontrada && result.company) {
        setCompany(result.company);
        setStage('form');
      } else {
        setStage('no-encontrada');
      }
    } catch {
      setVerifyError('No pudimos verificar el NIT. Verificá el dato e intentá de nuevo.');
    } finally {
      setVerifying(false);
    }
  }

  function handleChangeCompany() {
    setStage('nit');
    setCompany(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company) return;
    if (!reporterEmail.trim() && !reporterTelefono.trim()) {
      setSubmitError('Dejá al menos un dato de contacto: email o teléfono');
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const ticket = await publicTicketApi.create({
        nit: nit.trim(),
        titulo,
        descripcion: descripcion || undefined,
        categoriaId: categoriaId || undefined,
        subcategoriaId: subcategoriaId || undefined,
        reporterNombre,
        reporterEmail: reporterEmail || undefined,
        reporterTelefono: reporterTelefono || undefined,
      });
      setCreatedTicketId(ticket.id);
    } catch {
      setSubmitError('No se pudo registrar el ticket. Intentá de nuevo en unos minutos.');
    } finally {
      setSaving(false);
    }
  }

  if (createdTicketId) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 p-4">
        <PublicGradientBackdrop />
        <div className="relative z-10 w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto mb-3 text-green-600" size={40} />
          <h1 className="mb-2 text-lg font-semibold text-gray-900">Ticket registrado</h1>
          <p className="text-sm text-gray-600">
            Tu solicitud quedó registrada para <span className="font-medium">{company?.nombre}</span>.
            {reporterEmail && ' Te enviamos una confirmación por correo.'}
          </p>
          <p className="mt-3 font-mono text-xs text-gray-400">{createdTicketId.slice(0, 8)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 p-4">
      <PublicGradientBackdrop />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">Reportar un problema</h1>
        <p className="mb-6 text-sm text-gray-500">Sin necesidad de cuenta — dejanos tus datos de contacto.</p>

        {stage === 'nit' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className={labelClasses}>NIT de tu empresa</label>
              <input
                type="text"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                required
                placeholder="900123456"
                className={inputClasses}
              />
            </div>

            {verifyError && <p className="text-sm text-red-600">{verifyError}</p>}

            <button
              type="submit"
              disabled={verifying || nit.trim().length < 3}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {verifying ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        )}

        {stage === 'no-encontrada' && (
          <div className="space-y-4">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No encontramos una empresa registrada con ese NIT. Este formulario es solo para empresas ya
              registradas — si sos cliente particular o tu empresa todavía no está registrada, escribinos por el
              chat de soporte.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleChangeCompany}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Probar otro NIT
              </button>
              <Link
                to="/soporte"
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
              >
                Ir al chat de soporte
              </Link>
            </div>
          </div>
        )}

        {stage === 'form' && company && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <span>
                Empresa: <span className="font-medium">{company.nombre}</span>
              </span>
              <button
                type="button"
                onClick={handleChangeCompany}
                className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
              >
                Cambiar
              </button>
            </div>

            <div>
              <label className={labelClasses}>Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                minLength={3}
                placeholder="Resumen breve del problema"
                className={inputClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Contanos qué está pasando..."
                className={inputClasses}
              />
            </div>

            {categories.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => {
                      setCategoriaId(e.target.value);
                      setSubcategoriaId('');
                    }}
                    className={inputClasses}
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
                    className={inputClasses}
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
            )}

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tus datos de contacto</p>
              <div>
                <label className={labelClasses}>Nombre</label>
                <input
                  type="text"
                  value={reporterNombre}
                  onChange={(e) => setReporterNombre(e.target.value)}
                  required
                  minLength={2}
                  className={inputClasses}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Email</label>
                  <input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className={labelClasses}>Teléfono</label>
                  <input
                    type="tel"
                    value={reporterTelefono}
                    onChange={(e) => setReporterTelefono(e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">Dejá al menos uno de los dos.</p>
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="submit"
              disabled={saving || titulo.trim().length < 3 || reporterNombre.trim().length < 2}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Enviar ticket'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
