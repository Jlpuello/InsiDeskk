import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { CheckCircle2, XCircle } from 'lucide-react';
import { settingsApi } from '../api/settings.api.ts';
import { TicketCategoriesSection } from './TicketCategoriesSection.tsx';
import { SlaMatrixSection } from './SlaMatrixSection.tsx';
import { ActivityTemplatesSection } from './ActivityTemplatesSection.tsx';
import { TicketLevelVisibilitySection } from './TicketLevelVisibilitySection.tsx';
import { EmailSettingsSection } from './EmailSettingsSection.tsx';
import { DocumentationTemplatesSection } from './DocumentationTemplatesSection.tsx';
import { OrganizationSettingsSection } from './OrganizationSettingsSection.tsx';
import { SeoSettingsSection } from './SeoSettingsSection.tsx';
import type { RemotelySettings } from '../types/settings.types.ts';

type SettingsTab =
  | 'organizacion'
  | 'seo'
  | 'remotely'
  | 'categorias'
  | 'sla'
  | 'niveles'
  | 'actividades'
  | 'email'
  | 'plantillas';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'organizacion', label: 'Organización' },
  { id: 'seo', label: 'SEO' },
  { id: 'remotely', label: 'Remotely' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'sla', label: 'SLA' },
  { id: 'niveles', label: 'Niveles' },
  { id: 'actividades', label: 'Actividades' },
  { id: 'email', label: 'Email' },
  { id: 'plantillas', label: 'Plantillas' },
];

function RemotelySettingsSection() {
  const [settings, setSettings] = useState<RemotelySettings | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiKeySecret, setApiKeySecret] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getRemotely()
      .then((data) => {
        setSettings(data);
        setServerUrl(data.remotelyServerUrl);
        setApiKeyId(data.remotelyApiKeyId ?? '');
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const updated = await settingsApi.updateRemotely({
        remotelyServerUrl: serverUrl,
        // El ID y el secreto van siempre juntos: sin un secreto nuevo, un ID
        // nuevo no sirve de nada (el backend los exige de a par).
        ...(apiKeySecret.trim() && { remotelyApiKeyId: apiKeyId.trim(), remotelyApiKeySecret: apiKeySecret.trim() }),
      });
      setSettings(updated);
      setApiKeySecret('');
      setSavedMessage('Configuración guardada');
    } catch {
      setError('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <>
      {/* Ancho propio, más angosto que el resto de las secciones: es un
          formulario de pares label/input cortos — a lo ancho de la página
          (ver max-w-4xl en SettingsPage) los inputs quedarían estirados y
          feos, a diferencia de Categorías/SLA que sí aprovechan el espacio. */}
      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Remotely</h2>
          {settings?.remotelyApiKeySet ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 size={14} /> API key configurada
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <XCircle size={14} /> Sin API key
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-gray-400">
          En Remotely: Account → API Access. El ID queda siempre visible en esa tabla; el secreto solo se muestra
          una vez, justo al crear el token — copiá los dos en ese momento.
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">Server URL</label>
        <input
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://remotely.miempresa.com"
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">ID del token (Identificación)</label>
        <input
          type="text"
          value={apiKeyId}
          onChange={(e) => setApiKeyId(e.target.value)}
          placeholder="ej: 6d106057-feca-4301-846f-c9b1dc89d77a"
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">Secreto</label>
        <input
          type="password"
          value={apiKeySecret}
          onChange={(e) => setApiKeySecret(e.target.value)}
          placeholder={settings?.remotelyApiKeySet ? '•••••••• (dejar en blanco para no cambiarlo)' : 'Pegar el secreto del token'}
          autoComplete="off"
          className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="mb-4 text-xs text-gray-400">
          Por seguridad, el secreto guardado nunca se muestra — solo se sobreescribe si escribís uno nuevo (junto
          con el ID correspondiente a ese secreto).
        </p>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {savedMessage && <p className="mb-3 text-sm text-green-700">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>

        {settings?.updatedAt && (
          <p className="mt-3 text-xs text-gray-400">
            Última actualización: {new Date(settings.updatedAt).toLocaleString('es-ES')}
          </p>
        )}
      </form>
    </>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('organizacion');

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Configuración</h1>
      <p className="mb-6 text-sm text-gray-500">
        Integraciones y reglas de tickets de la plataforma. Aplica globalmente, no por empresa.
      </p>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'organizacion' && <OrganizationSettingsSection />}
      {tab === 'seo' && <SeoSettingsSection />}
      {tab === 'remotely' && <RemotelySettingsSection />}
      {tab === 'categorias' && <TicketCategoriesSection />}
      {tab === 'sla' && <SlaMatrixSection />}
      {tab === 'niveles' && <TicketLevelVisibilitySection />}
      {tab === 'actividades' && <ActivityTemplatesSection />}
      {tab === 'email' && <EmailSettingsSection />}
      {tab === 'plantillas' && <DocumentationTemplatesSection />}
    </div>
  );
}
