import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Building2, Laptop, Mail, Phone, Receipt, Ticket } from 'lucide-react';
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

// Home pública — lo que ve cualquiera que entre a "/" sin sesión (ver
// RootRoute.tsx). Antes no existía nada acá: un visitante caía directo al
// formulario de login sin ningún contexto de quién opera la plataforma ni
// qué hace. Datos de la empresa (razón social/NIT/teléfono/correo) vienen de
// Configuración → Organización — si todavía no está cargada, esa sección
// simplemente no se muestra.
export function HomeLandingPage() {
  const [org, setOrg] = useState<OrganizationPublicInfo | null>(null);

  useEffect(() => {
    organizationPublicApi.get().then(setOrg).catch(() => {});
  }, []);

  const hasOrgInfo = org && (org.razonSocial || org.nit || org.telefono || org.email);

  return (
    <div className="min-h-screen bg-white">
      <div className="relative overflow-hidden bg-slate-900">
        <PublicGradientBackdrop />

        <div className="relative z-10 flex flex-col items-center px-4 py-24 text-center sm:py-32">
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
              Iniciar sesión
            </Link>
            <Link
              to="/soporte"
              className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:text-base"
            >
              Pedir soporte
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-blue-700">Qué hacemos</p>
        <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">Nuestros servicios</h2>

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

      {hasOrgInfo && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-10 text-center">
            {org?.razonSocial && (
              <p className="mb-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-900">
                <Building2 size={15} className="text-gray-400" />
                {org.razonSocial}
                {org.nit && <span className="font-normal text-gray-400">· NIT {org.nit}</span>}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-gray-500">
              {org?.telefono && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} /> {org.telefono}
                </span>
              )}
              {org?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} /> {org.email}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
