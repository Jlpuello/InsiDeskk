import { useEffect, useState } from 'react';
import { documentationTemplateApi } from '../../features/documentation-templates/api/documentation-template.api.ts';
import type { DocumentationTemplateContext } from '../../features/documentation-templates/types/documentation-template.types.ts';

interface TemplatePickerProps {
  contexto: DocumentationTemplateContext;
  // Recibe el texto de la plantilla elegida — quien lo use decide si
  // reemplaza o concatena al contenido ya escrito.
  onInsert: (contenido: string) => void;
}

// Selector compacto de plantillas de documentación (Configuración →
// Plantillas) — se antepone al textarea de cierre de ticket, completar
// actividad o motivo de pausa. Sin plantillas cargadas para este contexto,
// no se muestra nada (no tiene sentido un selector vacío).
export function TemplatePicker({ contexto, onInsert }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<{ id: string; titulo: string; contenido: string }[]>([]);

  useEffect(() => {
    documentationTemplateApi
      .list(contexto)
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [contexto]);

  if (templates.length === 0) return null;

  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const template = templates.find((t) => t.id === e.target.value);
        if (template) onInsert(template.contenido);
        e.target.value = '';
      }}
      className="mb-2 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-600 focus:border-blue-500 focus:outline-none"
    >
      <option value="" disabled>
        Usar una plantilla...
      </option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.titulo}
        </option>
      ))}
    </select>
  );
}
