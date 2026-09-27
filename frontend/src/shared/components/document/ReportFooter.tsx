import { useEffect, useState } from 'react';
import { organizationPublicApi } from '../../api/organization-public.api.ts';

// Línea de membrete al pie de los informes imprimibles (Ticket/Device/
// InventoryReport) — mismo dato que formatIssuerLine arma para los PDF de
// cotización/acta en el backend, para que "imprimir/guardar como PDF" un
// informe HTML se sienta parte del mismo sistema de documentos. Público (no
// requiere admin): quien ve el informe no siempre tiene permiso para leer
// Configuración. No se muestra nada si Organización todavía no está cargada.
export function ReportFooter() {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    organizationPublicApi
      .get()
      .then((org) => {
        const parts = [org.razonSocial, org.nit && `NIT ${org.nit}`, org.telefono && `Tel. ${org.telefono}`, org.email].filter(
          Boolean,
        );
        setLine(parts.length > 0 ? parts.join(' · ') : null);
      })
      .catch(() => {});
  }, []);

  if (!line) return null;

  return <p className="mt-8 border-t border-gray-100 pt-3 text-center text-[11px] text-gray-400">{line}</p>;
}
