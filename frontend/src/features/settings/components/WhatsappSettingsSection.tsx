import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { settingsApi } from '../api/settings.api.ts';
import { apiClient } from '../../../shared/api/client.ts';
import type { WhatsappSettings } from '../types/settings.types.ts';

// URL pública que hay que pegar en Meta (Configuración de WhatsApp →
// Webhooks) — derivada del mismo baseURL que usa el resto de la app para
// hablarle a la API, no un valor separado a mantener sincronizado a mano.
const WEBHOOK_URL = `${apiClient.defaults.baseURL}/public/whatsapp/webhook`;

// Calco de RemotelySettingsSection (mismo patrón de formulario con secretos
// que nunca se muestran, solo un flag de "configurado") — ver ese
// componente para el criterio completo. El Webhook Verify Token es la
// excepción: viaja en claro (ver settings.types.ts) porque hay que poder
// copiarlo tal cual al dashboard de Meta.
export function WhatsappSettingsSection() {
  const [settings, setSettings] = useState<WhatsappSettings | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getWhatsapp()
      .then((data) => {
        setSettings(data);
        setPhoneNumberId(data.whatsappPhoneNumberId ?? '');
        setBusinessAccountId(data.whatsappBusinessAccountId ?? '');
        setWebhookVerifyToken(data.whatsappWebhookVerifyToken ?? '');
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
      const updated = await settingsApi.updateWhatsapp({
        whatsappBusinessAccountId: businessAccountId.trim() || undefined,
        // El phone number ID y el access token van siempre juntos: un token
        // solo sirve para el número con el que se generó.
        ...(accessToken.trim() && { whatsappPhoneNumberId: phoneNumberId.trim(), whatsappAccessToken: accessToken.trim() }),
        ...(appSecret.trim() && { whatsappAppSecret: appSecret.trim() }),
        // A diferencia de los secretos de arriba, este SÍ se manda siempre
        // que tenga contenido (no solo cuando cambió) — el usuario lo ve y
        // puede editarlo directamente, no hay "dejar en blanco para no tocar".
        ...(webhookVerifyToken.trim() && { whatsappWebhookVerifyToken: webhookVerifyToken.trim() }),
      });
      setSettings(updated);
      setWebhookVerifyToken(updated.whatsappWebhookVerifyToken ?? '');
      setAccessToken('');
      setAppSecret('');
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
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">WhatsApp Business</h2>
        {settings?.whatsappAccessTokenSet ? (
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
        API oficial de Meta (Cloud API) — se obtiene desde Meta for Developers, en la app de WhatsApp Business.
      </p>

      <div className="mb-4 rounded-md bg-gray-50 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Webhook (pegar en Meta)</p>
        <p className="break-all font-mono text-xs text-gray-700">{WEBHOOK_URL}</p>
      </div>

      <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number ID</label>
      <input
        type="text"
        value={phoneNumberId}
        onChange={(e) => setPhoneNumberId(e.target.value)}
        placeholder="ej: 109876543210987"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">Business Account ID</label>
      <input
        type="text"
        value={businessAccountId}
        onChange={(e) => setBusinessAccountId(e.target.value)}
        placeholder="ej: 123456789012345"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">Access Token</label>
      <input
        type="password"
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        placeholder={settings?.whatsappAccessTokenSet ? '•••••••• (dejar en blanco para no cambiarlo)' : 'Token permanente de la app'}
        autoComplete="off"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">App Secret</label>
      <input
        type="password"
        value={appSecret}
        onChange={(e) => setAppSecret(e.target.value)}
        placeholder={settings?.whatsappAppSecretSet ? '•••••••• (dejar en blanco para no cambiarlo)' : 'App Secret de la app de Meta'}
        autoComplete="off"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <p className="mb-4 text-xs text-gray-400">
        Distinto del Access Token — es el &quot;App Secret&quot; de la app (Configuración básica en Meta for
        Developers), se usa para verificar que cada mensaje entrante realmente viene de Meta.
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-700">Webhook Verify Token</label>
      <input
        type="text"
        value={webhookVerifyToken}
        onChange={(e) => setWebhookVerifyToken(e.target.value)}
        placeholder="Elegí un token — lo vas a pegar en Meta al dar de alta el webhook"
        autoComplete="off"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />
      <p className="mb-4 text-xs text-gray-400">
        No es secreto — Meta lo usa una sola vez para confirmar que este endpoint es tuyo al configurar el webhook.
        Access Token y App Secret sí son secretos: una vez guardados nunca se muestran, solo se sobreescriben si
        escribís uno nuevo.
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
  );
}
