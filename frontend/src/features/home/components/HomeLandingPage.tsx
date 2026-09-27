import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Boxes, Building2, Laptop, Mail, MessageCircle, Phone, Receipt, Ticket } from 'lucide-react';
import { PublicGradientBackdrop } from '../../../shared/components/PublicGradientBackdrop.tsx';
import { organizationPublicApi, type OrganizationPublicInfo } from '../../../shared/api/organization-public.api.ts';

const SERVICIOS = [
  {
    icon: Ticket,
    titulo: 'Mesa de ayuda',
    descripcion: 'Reportá un problema y seguí su avance de principio a fin, con SLA y prioridad claros.',
  },
  {
    icon: Laptop,
    titulo: 'Soporte remoto',
    descripcion: 'Asistencia técnica a tus equipos sin que nadie tenga que moverse de su puesto.',
  },
  {
    icon: Boxes,
    titulo: 'Gestión de activos',
    descripcion: 'Inventario de equipos y dispositivos de red, con hoja de vida e historial de cada uno.',
  },
  {
    icon: Receipt,
    titulo: 'Cotizaciones y aprobaciones',
    descripcion: 'Cambios que requieren costo adicional se cotizan y aprueban dentro del mismo ticket.',
  },
] as const;

const SLIDE_COUNT = 3;
const SLIDE_INTERVAL_MS = 7000;

// Home pública — lo que ve cualquiera que entre a "/" sin sesión (ver
// RootRoute.tsx). Tres secciones a pantalla completa (hero, servicios,
// contacto) que se van turnando solas — mismo criterio de crossfade que ya
// usa PublicGradientBackdrop para el fondo, ahora aplicado al contenido
// completo — con puntos abajo para saltar a una en particular a mano.
export function HomeLandingPage() {
  const [org, setOrg] = useState<OrganizationPublicInfo | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    organizationPublicApi.get().then(setOrg).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveSlide((s) => (s + 1) % SLIDE_COUNT), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const hasOrgInfo = org && (org.razonSocial || org.nit || org.telefono || org.email);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {/* Slide 1 — hero */}
      <section
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-slate-900 px-4 text-center transition-opacity duration-700',
          activeSlide === 0 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <PublicGradientBackdrop />
        <div className="relative z-10 flex flex-col items-center">
          <span className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-800">
            <Ticket size={24} />
          </span>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-300">InsiDesk · Mesa de ayuda</p>
          <h1 className="mb-4 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
            Soporte técnico y gestión de equipos, todo en un solo lugar
          </h1>
          <p className="mb-8 max-w-md text-sm text-slate-200 sm:text-base">
            Tickets, dispositivos, inventario y cotizaciones — con seguimiento claro de principio a fin.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-blue-800 shadow-lg transition-transform hover:scale-[1.02] hover:bg-blue-50 sm:text-base"
            >
              Soy técnico / Cliente
            </Link>
            <Link
              to="/soporte"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:text-base"
            >
              Pedir soporte
            </Link>
          </div>
        </div>
      </section>

      {/* Slide 2 — servicios */}
      <section
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-white px-4 py-12 transition-opacity duration-700',
          activeSlide === 1 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-700">Qué hacemos</p>
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900 sm:text-3xl">Nuestros servicios</h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map(({ icon: Icon, titulo, descripcion }) => (
              <div key={titulo} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon size={19} />
                </span>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">{titulo}</h3>
                <p className="text-sm text-gray-500">{descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slide 3 — contacto */}
      <section
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center bg-gray-50 px-4 text-center transition-opacity duration-700',
          activeSlide === 2 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <span className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Building2 size={22} />
        </span>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Contacto</p>

        {hasOrgInfo ? (
          <>
            <h2 className="mb-1 text-2xl font-semibold text-gray-900 sm:text-3xl">{org?.razonSocial ?? 'InsiDesk'}</h2>
            {org?.nit && <p className="mb-6 text-sm text-gray-400">NIT {org.nit}</p>}
            <div className="flex flex-col items-center gap-3 text-sm text-gray-600 sm:flex-row sm:gap-6">
              {org?.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} /> {org.telefono}
                </span>
              )}
              {org?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={14} /> {org.email}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-2xl font-semibold text-gray-900 sm:text-3xl">¿Tenés dudas?</h2>
            <p className="mb-6 max-w-sm text-sm text-gray-500">
              Escribinos por el chat de soporte y te respondemos al instante.
            </p>
            <Link
              to="/soporte"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <MessageCircle size={16} />
              Ir a soporte
            </Link>
          </>
        )}
      </section>

      {/* Navegación entre secciones */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-slate-900/70 px-3 py-2 shadow-lg backdrop-blur">
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <button
            key={i}
            onClick={() => setActiveSlide(i)}
            aria-label={`Ir a la sección ${i + 1}`}
            aria-current={activeSlide === i}
            className={clsx(
              'h-2 rounded-full transition-all',
              activeSlide === i ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60',
            )}
          />
        ))}
      </div>
    </div>
  );
}
