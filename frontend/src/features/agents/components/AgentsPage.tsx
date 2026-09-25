import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Building2, Check, Copy, Download } from 'lucide-react';
import { companyApi } from '../../companies/api/company.api.ts';
import { agentApi } from '../api/agent.api.ts';
import type { Company } from '../../companies/types/company.types.ts';
import type { AgentScriptInfo } from '../types/agent.types.ts';

type OsTab = 'windows' | 'ubuntu' | 'manjaro';

const TAB_LABELS: Record<OsTab, string> = {
  windows: 'Windows',
  ubuntu: 'Ubuntu',
  manjaro: 'Manjaro',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // El portapapeles puede fallar en contextos no seguros o sin permiso —
      // el comando ya está visible y seleccionable a mano igual.
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar comando'}
    </button>
  );
}

// Descarga client-side vía Blob — no depende de que el backend sirva el
// archivo, el contenido ya viene en la respuesta de /remotely/agent-script.
function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AgentsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [script, setScript] = useState<AgentScriptInfo | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [tab, setTab] = useState<OsTab>('windows');

  useEffect(() => {
    companyApi
      .list()
      .then(setCompanies)
      .finally(() => setLoading(false));
  }, []);

  function selectCompany(company: Company) {
    setSelectedId(company.id);
    setScript(null);
    setScriptError(null);
    setTab('windows');
    if (!company.remotelyGroupId) return;

    setLoadingScript(true);
    agentApi
      .getScript(company.id)
      .then(setScript)
      .catch(() => setScriptError('No se pudo generar el comando. Verificá la configuración de Remotely.'))
      .finally(() => setLoadingScript(false));
  }

  const selected = companies.find((c) => c.id === selectedId);
  const activeCommand = script && (tab === 'windows' ? script.windows.command : script.linux[tab]);

  if (loading) return <p className="p-6 text-gray-500">Cargando empresas...</p>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Agentes</h1>
        <p className="text-sm text-gray-500">
          Generá el comando de instalación del agente de Remotely para cada empresa — en Windows, el equipo cae
          directo en su grupo (y por lo tanto empresa) correcta.
        </p>
      </div>

      {companies.length === 0 ? (
        <p className="text-gray-500">No hay empresas registradas todavía.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[280px_1fr]">
          <div className="space-y-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => selectCompany(company)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  selectedId === company.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    selectedId === company.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  <Building2 size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate">{company.nombre}</span>
                {!company.remotelyGroupId && (
                  <span className="shrink-0 text-xs text-gray-400">Sin grupo</span>
                )}
              </button>
            ))}
          </div>

          <div>
            {!selected && <p className="text-sm text-gray-400">Elegí una empresa para generar su agente.</p>}

            {selected && !selected.remotelyGroupId && (
              <p className="text-sm text-amber-600">
                &quot;{selected.nombre}&quot; no tiene un grupo de Remotely mapeado — asignaselo primero en{' '}
                <span className="font-medium">Empresas</span>.
              </p>
            )}

            {selected && selected.remotelyGroupId && (
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                {loadingScript && <p className="text-sm text-gray-500">Generando...</p>}
                {scriptError && <p className="text-sm text-red-600">{scriptError}</p>}

                {script && (
                  <>
                    <div className="mb-4 flex gap-2 border-b border-gray-100 pb-3">
                      {(Object.keys(TAB_LABELS) as OsTab[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={clsx(
                            'rounded-md px-3 py-1.5 text-sm font-medium',
                            tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50',
                          )}
                        >
                          {TAB_LABELS[t]}
                        </button>
                      ))}
                    </div>

                    {script.groupName === null ? (
                      <p className="mb-2 text-xs text-amber-600">
                        Esta empresa no tiene un grupo de Remotely mapeado — el equipo se instala igual, pero queda
                        sin grupo asignado hasta que lo organices a mano desde Remotely.
                      </p>
                    ) : tab === 'windows' ? (
                      <p className="mb-2 text-xs text-gray-400">
                        Este equipo caerá directo en el grupo <strong>{script.groupName}</strong>.
                      </p>
                    ) : (
                      <p className="mb-2 text-xs text-amber-600">
                        Este instalador de Linux no soporta asignar grupo automáticamente — después de instalar,
                        asignalo al grupo <strong>{script.groupName}</strong> manualmente desde Remotely.
                      </p>
                    )}

                    <pre className="mb-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-gray-900 p-3 font-mono text-xs text-gray-100">
                      {activeCommand}
                    </pre>

                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={activeCommand ?? ''} />
                      {tab === 'windows' && (
                        <button
                          onClick={() =>
                            downloadFile(`instalar-agente-${selected.nombre}.bat`, script.windows.batContent)
                          }
                          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Descargar .bat
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
