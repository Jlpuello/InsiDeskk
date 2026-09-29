import { useEffect, useState } from 'react';
import { LegalPageLayout } from './LegalPageLayout.tsx';
import { organizationPublicApi, type OrganizationPublicInfo } from '../../../shared/api/organization-public.api.ts';
import { useSeoMeta } from '../../../shared/hooks/useSeoMeta.ts';

const LAST_UPDATED = '2026-09-29';

// Plantilla genérica de política de privacidad — punto de partida razonable,
// no texto legal certificado para ninguna jurisdicción en particular.
export function PrivacyPage() {
  const [org, setOrg] = useState<OrganizationPublicInfo | null>(null);

  useSeoMeta({
    fallbackTitle: 'Política de privacidad · InsiDesk',
    fallbackDescription: 'Cómo InsiDesk recolecta, usa y protege tus datos personales.',
  });

  useEffect(() => {
    organizationPublicApi.get().then(setOrg).catch(() => {});
  }, []);

  const entidad = org?.razonSocial || 'InsiDesk';
  const contacto = org?.email;

  return (
    <LegalPageLayout title="Política de privacidad" updatedLabel={`Última actualización: ${LAST_UPDATED}`}>
      <p>
        Esta política describe qué datos recolecta <strong>{entidad}</strong> a través de la plataforma InsiDesk,
        para qué los usa y qué derechos tenés sobre ellos.
      </p>

      <h2>1. Qué datos recolectamos</h2>
      <ul>
        <li>Datos de cuenta: nombre, correo, teléfono, empresa y rol.</li>
        <li>Contenido que cargás: tickets, notas, adjuntos, firmas de actas y cotizaciones.</li>
        <li>Datos técnicos de dispositivos que autorizaste a monitorear (IP local, hardware, software instalado).</li>
        <li>Metadatos de uso: fecha de acceso, dirección IP y navegador, con fines de seguridad y auditoría.</li>
      </ul>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Prestar el servicio de mesa de ayuda, soporte remoto y gestión de activos.</li>
        <li>Enviar notificaciones sobre tickets, actividades y cotizaciones (correo, WhatsApp si está habilitado).</li>
        <li>Generar informes, actas y cotizaciones en PDF asociados a tu empresa.</li>
        <li>Detectar y prevenir accesos no autorizados o uso indebido de la plataforma.</li>
      </ul>

      <h2>3. Con quién los compartimos</h2>
      <p>
        No vendemos tus datos. Se comparten únicamente dentro de tu propia empresa (con el personal técnico
        asignado) y con proveedores necesarios para operar el servicio (por ejemplo, envío de correo o soporte
        remoto), bajo las mismas obligaciones de confidencialidad.
      </p>

      <h2>4. Seguridad</h2>
      <p>
        Las contraseñas se almacenan cifradas, las sesiones viajan por cookies protegidas, y los datos sensibles
        (como direcciones IP registradas para trazabilidad) se cifran en reposo. El acceso a la información de cada
        empresa está restringido a su propio personal y a los administradores de la plataforma.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        Podés solicitar acceso, corrección o eliminación de tus datos personales, salvo la información que debamos
        conservar por obligación legal o para la trazabilidad de casos ya cerrados.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Usamos cookies estrictamente necesarias para mantener tu sesión iniciada y para protección contra ataques
        CSRF. No usamos cookies de rastreo publicitario.
      </p>

      <h2>7. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política en cualquier momento. Los cambios relevantes se reflejan en la fecha de
        &ldquo;última actualización&rdquo; al inicio de esta página.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para ejercer tus derechos o hacer una consulta sobre esta política{contacto ? (
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
