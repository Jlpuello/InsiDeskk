import { useEffect, useState } from 'react';
import { LegalPageLayout } from './LegalPageLayout.tsx';
import { organizationPublicApi, type OrganizationPublicInfo } from '../../../shared/api/organization-public.api.ts';
import { useSeoMeta } from '../../../shared/hooks/useSeoMeta.ts';

const LAST_UPDATED = '2026-09-29';

// Plantilla genérica de términos y condiciones para un proveedor de mesa de
// ayuda/soporte técnico — pensada como punto de partida razonable, no como
// texto legal certificado para ninguna jurisdicción en particular (eso lo
// define el equipo legal de quien opere la instancia).
export function TermsPage() {
  const [org, setOrg] = useState<OrganizationPublicInfo | null>(null);

  useSeoMeta({
    fallbackTitle: 'Términos y condiciones · InsiDesk',
    fallbackDescription: 'Términos y condiciones de uso de la plataforma InsiDesk.',
  });

  useEffect(() => {
    organizationPublicApi.get().then(setOrg).catch(() => {});
  }, []);

  const entidad = org?.razonSocial || 'InsiDesk';
  const contacto = org?.email;

  return (
    <LegalPageLayout title="Términos y condiciones" updatedLabel={`Última actualización: ${LAST_UPDATED}`}>
      <p>
        Estos términos regulan el uso de la plataforma InsiDesk operada por <strong>{entidad}</strong> (&ldquo;nosotros&rdquo;,
        &ldquo;la plataforma&rdquo;). Al acceder o usar el servicio, aceptás estos términos en su totalidad.
      </p>

      <h2>1. Descripción del servicio</h2>
      <p>
        InsiDesk es una plataforma de mesa de ayuda que permite reportar y hacer seguimiento de incidentes técnicos,
        gestionar dispositivos e inventario, y generar cotizaciones asociadas a solicitudes de cambio.
      </p>

      <h2>2. Cuentas y acceso</h2>
      <p>
        El acceso a la plataforma requiere una cuenta provista por {entidad} o por la empresa que te representa. Sos
        responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu
        cuenta.
      </p>

      <h2>3. Uso aceptable</h2>
      <p>Al usar la plataforma, te comprometés a no:</p>
      <ul>
        <li>Usarla para fines distintos al soporte técnico y la gestión de activos autorizados.</li>
        <li>Intentar vulnerar la seguridad de la plataforma o acceder a datos de otras empresas.</li>
        <li>Cargar contenido ilegal, difamatorio o que infrinja derechos de terceros.</li>
      </ul>

      <h2>4. Cotizaciones y aprobaciones</h2>
      <p>
        Las cotizaciones generadas dentro de un ticket son propuestas de costo asociadas a un cambio o trabajo
        adicional. Su aprobación (por la persona autorizada de tu empresa) constituye una autorización para
        proceder, en los términos comerciales que se hayan acordado por separado.
      </p>

      <h2>5. Propiedad intelectual</h2>
      <p>
        El software, diseño y marca de InsiDesk son propiedad de {entidad}. Esto no incluye los datos que vos o tu
        empresa cargan en la plataforma (tickets, adjuntos, información de dispositivos), que siguen siendo de su
        propiedad.
      </p>

      <h2>6. Limitación de responsabilidad</h2>
      <p>
        La plataforma se provee &ldquo;tal cual&rdquo;. {entidad} no garantiza disponibilidad ininterrumpida y no responde por
        daños indirectos derivados del uso o la imposibilidad de uso del servicio, salvo lo que establezca la ley
        aplicable o un contrato específico entre las partes.
      </p>

      <h2>7. Modificaciones</h2>
      <p>
        Podemos actualizar estos términos en cualquier momento. Los cambios relevantes se reflejan en la fecha de
        &ldquo;última actualización&rdquo; al inicio de esta página.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para consultas sobre estos términos{contacto ? (
          <>
            {' '}escribinos a <a className="text-blue-700 underline" href={`mailto:${contacto}`}>{contacto}</a>.
          </>
        ) : (
          '.'
        )}
      </p>
    </LegalPageLayout>
  );
}
