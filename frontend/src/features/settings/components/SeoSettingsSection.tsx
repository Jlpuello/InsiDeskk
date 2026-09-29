import { useEffect, useState, type FormEvent } from 'react';
import { settingsApi } from '../api/settings.api.ts';
import type { SeoSettings } from '../types/settings.types.ts';

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

// Se aplica client-side (ver useSeoMeta) en las páginas públicas — home,
// /soporte, /reportar. Sin SSR esto ayuda al tab del navegador y a un
// crawler que ejecute JS, pero NO a un scraper de preview (Slack/WhatsApp),
// que solo lee el HTML crudo de index.html — para eso quedan los valores por
// defecto ya escritos ahí. Los límites de caracteres son orientativos (lo
// que Google trunca en el resultado de búsqueda), no un límite duro real.
export function SeoSettingsSection() {
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getSeo()
      .then((data) => {
        setSettings(data);
        setTitle(data.seoMetaTitle ?? '');
        setDescription(data.seoMetaDescription ?? '');
        setKeywords(data.seoMetaKeywords ?? '');
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
      const updated = await settingsApi.updateSeo({
        seoMetaTitle: title.trim(),
        seoMetaDescription: description.trim(),
        seoMetaKeywords: keywords.trim(),
      });
      setSettings(updated);
      setSavedMessage('Configuración guardada');
    } catch {
      setError('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">SEO</h2>
      <p className="mb-4 text-xs text-gray-400">
        Título y descripción que se muestran en el resultado de búsqueda y en la pestaña del navegador para la home
        pública, /soporte y /reportar.
      </p>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <span className={`text-xs ${title.length > TITLE_LIMIT ? 'text-amber-600' : 'text-gray-400'}`}>
            {title.length}/{TITLE_LIMIT}
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="InsiDesk · Mesa de ayuda y soporte técnico"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Descripción</label>
          <span className={`text-xs ${description.length > DESCRIPTION_LIMIT ? 'text-amber-600' : 'text-gray-400'}`}>
            {description.length}/{DESCRIPTION_LIMIT}
          </span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Mesa de ayuda, soporte remoto, gestión de equipos y cotizaciones en un solo lugar."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="mb-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Palabras clave</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="mesa de ayuda, soporte técnico, tickets, soporte remoto"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <p className="mb-4 text-xs text-gray-400">Separadas por coma. Peso casi nulo hoy en Google, pero las sigue usando Bing/otros buscadores.</p>

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
