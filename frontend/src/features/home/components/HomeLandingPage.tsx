import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Boxes, Building2, Laptop, Mail, MessageCircle, Phone, Receipt, Ticket } from 'lucide-react';
import { PublicGradientBackdrop } from '../../../shared/components/PublicGradientBackdrop.tsx';
import { SoftGradientBackdrop } from '../../../shared/components/SoftGradientBackdrop.tsx';
import { organizationPublicApi, type OrganizationPublicInfo } from '../../../shared/api/organization-public.api.ts';
import { useSeoMeta } from '../../../shared/hooks/useSeoMeta.ts';
import { usePrefersReducedMotion } from '../../../shared/hooks/usePrefersReducedMotion.ts';

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
const SLIDE_LABELS = ['Inicio', 'Servicios', 'Contacto'] as const;

// Home pública — lo que ve cualquiera que entre a "/" sin sesión (ver
// RootRoute.tsx). Tres secciones a pantalla completa (hero, servicios,
// contacto) que se van turnando solas — mismo criterio de crossfade que ya
// usa PublicGradientBackdrop para el fondo, ahora aplicado al contenido
// completo — con puntos abajo para saltar a una en particular a mano.
export function HomeLandingPage() {
  const [org, setOrg] = useState<OrganizationPublicInfo | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  // Se pausa con el mouse encima o con foco adentro (teclado) — antes el
  // carrusel te sacaba de la sección de servicios a mitad de lectura sin
  // forma de detenerlo. Ver usePrefersReducedMotion: además, quien prefiere
  // menos movimiento no lo tiene corriendo nunca.
  const [hovered, setHovered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useSeoMeta({
    fallbackTitle: 'InsiDesk · Mesa de ayuda y soporte técnico',
    fallbackDescription:
      'Mesa de ayuda, soporte remoto, gestión de equipos y cotizaciones en un solo lugar, con seguimiento claro de principio a fin.',
  });

  useEffect(() => {
    organizationPublicApi.get().then(setOrg).catch(() => {});
  }, []);

  useEffect(() => {
    if (hovered || reducedMotion) return;
    const id = setInterval(() => setActiveSlide((s) => (s + 1) % SLIDE_COUNT), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hovered, reducedMotion]);

  const hasOrgInfo = org && (org.razonSocial || org.nit || org.telefono || org.email);

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Acceso persistente a /login — antes, si algo fallaba o se entraba
          por un link directo a la sección 2/3, el único camino de vuelta era
          el botón del hero en la sección 1. */}
      <Link
        to="/login"
        className="fixed right-4 top-4 z-30 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-900/90 sm:text-sm"
      >
        Iniciar sesión
      </Link>

      {/* Slide 1 — hero */}
      <section
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-slate-900 px-4 text-center transition-opacity duration-700',
          activeSlide === 0 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <PublicGradientBackdrop paused={activeSlide !== 0} />
        <div className="relative z-10 flex flex-col items-center">
          <span className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-800">
            <Ticket size={24} />
          </span>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-300">InsiDesk · Mesa de ayuda</p>
          <h1 className="mb-4 max-w-2xl text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            Soporte técnico y gestión de equipos, todo en un solo lugar
          </h1>
          <p className="mb-8 max-w-md text-sm text-slate-200 sm:text-base lg:max-w-lg lg:text-lg">
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
          <p className="mt-3 text-xs text-blue-200/80">¿Ya tenés una cuenta? Usá el primer botón para ingresar.</p>
        </div>
      </section>

      {/* Slide 2 — servicios */}
      <section
        className={clsx(
          // justify-start (no -center) en mobile: con contenido más alto que
          // la pantalla, "centrar" + overflow hace que el navegador arranque
          // el scroll a mitad del bloque (no en el padding-top real), así
          // que agregar más padding arriba no alcanzaba — con justify-start
          // el padding SÍ es el punto de partida real. sm:justify-center
          // vuelve a centrar en desktop, donde las 4 tarjetas entran sin
          // scroll y centrado se ve mejor. pt-20/pb-24: lugar para el botón
          // fijo de "Iniciar sesión" arriba y la navegación fija abajo.
          'absolute inset-0 flex flex-col items-center justify-start overflow-y-auto bg-white px-4 pb-24 pt-20 transition-opacity duration-700 sm:justify-center sm:py-12',
          activeSlide === 1 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <SoftGradientBackdrop />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-700">Qué hacemos</p>
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900 sm:text-3xl lg:text-4xl">Nuestros servicios</h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map(({ icon: Icon, titulo, descripcion }) => (
              <div key={titulo} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon size={22} />
                </span>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">{titulo}</h3>
                <p className="text-sm text-gray-500">{descripcion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pista de que hay más para scrollear — en mobile las 4 tarjetas no
            entran en una pantalla (a diferencia de las otras 2 secciones,
            que nunca scrollean) y sin esto la última tarjeta cortada se lee
            como un error, no como que sigue más abajo. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent sm:hidden" />
      </section>

      {/* Slide 3 — contacto */}
      <section
        className={clsx(
          'absolute inset-0 flex flex-col items-center justify-center bg-gray-50 px-4 text-center transition-opacity duration-700',
          activeSlide === 2 ? 'z-10 opacity-100' : 'z-0 opacity-0',
        )}
      >
        <SoftGradientBackdrop />
        <div className="relative z-10 flex flex-col items-center">
          <span className="mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Building2 size={22} />
          </span>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700">Contacto</p>

          {hasOrgInfo ? (
            <>
              <h2 className="mb-1 text-2xl font-semibold text-gray-900 sm:text-3xl lg:text-4xl">{org?.razonSocial ?? 'InsiDesk'}</h2>
              {org?.nit && <p className="mb-6 text-sm text-gray-400">NIT {org.nit}</p>}
              <div className="mb-8 flex flex-col items-center gap-3 text-sm text-gray-600 sm:flex-row sm:gap-6">
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
              <h2 className="mb-2 text-2xl font-semibold text-gray-900 sm:text-3xl lg:text-4xl">¿Tenés dudas?</h2>
              <p className="mb-6 max-w-sm text-sm text-gray-500">
                Escribinos por el chat de soporte y te respondemos al instante.
              </p>
            </>
          )}

          {/* Antes este botón solo existía cuando NO había datos de
              Organización cargados — con Organización ya configurada
              (caso real hoy), quien llegaba a esta sección no tenía nada
              para clickear. */}
          <Link
            to="/soporte"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <MessageCircle size={16} />
            Ir a soporte
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-16 z-10 flex flex-col items-center gap-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <Link to="/terminos" className="hover:text-gray-600 hover:underline">
              Términos y condiciones
            </Link>
            <span className="text-gray-300">·</span>
            <Link to="/privacidad" className="hover:text-gray-600 hover:underline">
              Política de privacidad
            </Link>
          </div>
          <p>© {new Date().getFullYear()} {org?.razonSocial || 'InsiDesk'}</p>
        </div>
      </section>

      {/* Navegación entre secciones — con etiqueta en vez de puntos ciegos:
          acá el carrusel es TODA la página, no un detalle decorativo, así
          que vale la pena que se note qué hay detrás de cada una. */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full bg-slate-900/70 p-1 shadow-lg backdrop-blur">
        {SLIDE_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setActiveSlide(i)}
            aria-current={activeSlide === i}
            className={clsx(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              activeSlide === i ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
