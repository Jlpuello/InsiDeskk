import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Upload, XCircle } from 'lucide-react';
import { settingsApi } from '../api/settings.api.ts';
import type { AiSettings } from '../types/settings.types.ts';

// Estructura sugerida para el contexto — se precarga en el textarea si está
// vacío, para que el admin edite en vez de partir de una hoja en blanco.
const SYSTEM_PROMPT_TEMPLATE = `## Tono
Cordial y directo, respuestas cortas. Evitá tecnicismos innecesarios.

## Pasos básicos de soporte
- Internet lento o intermitente: sugerí reiniciar el router (30 segundos apagado) y revisar cables.
- No enciende el equipo: verificar la conexión eléctrica y el cable de corriente.
- (Agregá acá los problemas más comunes de tus clientes y los pasos que ya les das siempre.)

## Cuándo crear un ticket
Si diste los pasos básicos y el problema sigue, o el usuario pide explícitamente reportarlo.

## Cuándo derivar a un agente humano
Si el usuario lo pide explícitamente, o el problema es urgente/complejo y no se resuelve por chat.
`;

// Chat de soporte con IA — usa esta conexión para conversar libremente y,
// cuando corresponde, disparar la preparación de un ticket o la derivación a
// un agente (ver features/ai/ en el backend y FloatingSupportWidget.tsx).
export function AiSettingsSection() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi
      .getAi()
      .then((data) => {
        setSettings(data);
        if (data.aiProvider === 'anthropic' || data.aiProvider === 'openai') setProvider(data.aiProvider);
        setModel(data.aiModel ?? '');
        setEnabled(data.aiEnabled);
        setSystemPrompt(data.aiSystemPrompt ?? SYSTEM_PROMPT_TEMPLATE);
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSystemPrompt(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const updated = await settingsApi.updateAi({
        aiModel: model.trim() || undefined,
        aiEnabled: enabled,
        aiSystemPrompt: systemPrompt,
        // El proveedor y la key van siempre juntos: una key solo tiene
        // sentido para el proveedor con el que se generó.
        ...(apiKey.trim() && { aiProvider: provider, aiApiKey: apiKey.trim() }),
      });
      setSettings(updated);
      setApiKey('');
      setSavedMessage('Configuración guardada');
    } catch {
      setError('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Inteligencia artificial</h2>
        {settings?.aiApiKeySet ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700">
            <CheckCircle2 size={14} /> Configurado
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
            <XCircle size={14} /> Sin configurar
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Chat de soporte con IA — conversa libremente con quien te escribe y puede armar un ticket o derivar a un
        agente humano cuando corresponde (ver la opción &quot;Hablar con un asistente&quot; en el árbol del
        chatbot).
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor</label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as 'anthropic' | 'openai')}
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="openai">OpenAI</option>
      </select>

      <label className="mb-1 block text-sm font-medium text-gray-700">Modelo</label>
      <input
        type="text"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="ej: claude-sonnet-5"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={settings?.aiApiKeySet ? '•••••••• (dejar en blanco para no cambiarlo)' : 'Pegar la API key'}
        autoComplete="off"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <p className="mb-4 text-xs text-gray-400">
        Por seguridad, la key guardada nunca se muestra — solo se sobreescribe si escribís una nueva.
      </p>

      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Contexto para el asistente (Markdown)</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Upload size={12} /> Subir archivo .md
        </button>
        <input ref={fileInputRef} type="file" accept=".md,text/markdown,text/plain" onChange={handleFileUpload} className="hidden" />
      </div>
      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        rows={10}
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
      />
      <p className="mb-4 text-xs text-gray-400">
        Tono, pasos básicos de soporte y cuándo crear un ticket o derivar a un agente. Se manda tal cual en cada
        conversación — no es secreto, pero tampoco lo comparte el asistente si se lo piden.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded" />
        Habilitar el chat con IA en la landing de soporte
      </label>

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
  );
}
