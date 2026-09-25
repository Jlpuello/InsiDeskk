import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { settingsApi } from '../api/settings.api.ts';
import type { EmailSettings } from '../types/settings.types.ts';

// Envío de correo — Resend (variable de entorno RESEND_API_KEY, sigue siendo
// el default si no se toca nada acá) o un SMTP propio (Gmail/Office365 con
// contraseña de aplicación, hosting, etc.). Ver
// features/notifications/jobs/send-email.job.ts.
export function EmailSettingsSection() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [provider, setProvider] = useState<'resend' | 'smtp'>('resend');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getEmail()
      .then((data) => {
        setSettings(data);
        if (data.emailProvider === 'smtp') setProvider('smtp');
        setSmtpHost(data.smtpHost ?? '');
        setSmtpPort(data.smtpPort?.toString() ?? '');
        setSmtpUser(data.smtpUser ?? '');
        setSmtpFrom(data.smtpFrom ?? '');
        setSmtpSecure(data.smtpSecure ?? true);
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
      const updated = await settingsApi.updateEmail({
        emailProvider: provider,
        ...(provider === 'smtp' && {
          smtpHost: smtpHost.trim(),
          smtpPort: smtpPort ? Number(smtpPort) : undefined,
          smtpUser: smtpUser.trim(),
          smtpFrom: smtpFrom.trim(),
          smtpSecure,
          ...(smtpPassword.trim() && { smtpPassword: smtpPassword.trim() }),
        }),
      });
      setSettings(updated);
      setSmtpPassword('');
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
        <h2 className="text-sm font-semibold text-gray-900">Envío de correo</h2>
        {provider === 'smtp' ? (
          settings?.smtpPasswordSet ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 size={14} /> SMTP configurado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <XCircle size={14} /> SMTP sin configurar
            </span>
          )
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-500">Vía Resend (variable de entorno)</span>
        )}
      </div>
      <p className="mb-4 text-xs text-gray-400">
        Por defecto se envía por Resend (configurado por variable de entorno). Elegí SMTP para usar tu propia
        cuenta de correo (Gmail, Office365, tu hosting, etc.) en su lugar.
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor</label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as 'resend' | 'smtp')}
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="resend">Resend (por defecto)</option>
        <option value="smtp">SMTP propio</option>
      </select>

      {provider === 'smtp' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Host SMTP</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Puerto</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <label className="mb-1 block text-sm font-medium text-gray-700">Usuario</label>
          <input
            type="text"
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            placeholder="soporte@tuempresa.com"
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña de aplicación</label>
          <input
            type="password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            placeholder={settings?.smtpPasswordSet ? '•••••••• (dejar en blanco para no cambiarla)' : 'Contraseña de aplicación'}
            autoComplete="off"
            className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="mb-4 text-xs text-gray-400">
            En Gmail/Google Workspace, generá una &quot;contraseña de aplicación&quot; en la configuración de
            seguridad de la cuenta — no uses la contraseña normal de login.
          </p>

          <label className="mb-1 block text-sm font-medium text-gray-700">Remitente</label>
          <input
            type="email"
            value={smtpFrom}
            onChange={(e) => setSmtpFrom(e.target.value)}
            placeholder="soporte@tuempresa.com"
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="rounded" />
            Conexión segura (TLS) — activalo para el puerto 465, desactivalo para 587/25
          </label>
        </>
      )}

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
