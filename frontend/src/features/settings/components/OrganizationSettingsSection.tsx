import { useEffect, useState, type FormEvent } from 'react';
import { settingsApi } from '../api/settings.api.ts';
import type { OrganizationSettings } from '../types/settings.types.ts';

// A diferencia del resto de las pestañas (Remotely/WhatsApp/IA/Email), nada
// acá es secreto — es la identidad legal de la empresa que OPERA esta
// instancia (no confundir con Empresas, que son las empresas CLIENTE). Se
// usa como membrete en cotizaciones/actas/informes en PDF (ver
// formatIssuerLine en el backend) y en la home pública.
export function OrganizationSettingsSection() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [razonSocial, setRazonSocial] = useState('');
  const [nit, setNit] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .getOrganization()
      .then((data) => {
        setSettings(data);
        setRazonSocial(data.orgRazonSocial ?? '');
        setNit(data.orgNit ?? '');
        setTelefono(data.orgTelefono ?? '');
        setEmail(data.orgEmail ?? '');
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
      const updated = await settingsApi.updateOrganization({
        orgRazonSocial: razonSocial.trim(),
        orgNit: nit.trim(),
        orgTelefono: telefono.trim(),
        orgEmail: email.trim(),
      });
      setSettings(updated);
      setSavedMessage('Configuración guardada');
    } catch {
      setError('No se pudo guardar la configuración — revisá el formato del NIT/correo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando configuración...</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Organización</h2>
      <p className="mb-4 text-xs text-gray-400">
        Identidad legal de la empresa que opera esta instancia — aparece como membrete en cotizaciones, actas e
        informes en PDF, y en la home pública.
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-700">Razón social</label>
      <input
        type="text"
        value={razonSocial}
        onChange={(e) => setRazonSocial(e.target.value)}
        placeholder="Servicios Técnicos S.A.S."
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">NIT</label>
      <input
        type="text"
        value={nit}
        onChange={(e) => setNit(e.target.value)}
        placeholder="900123456"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
      <input
        type="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="+57 300 000 0000"
        className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-sm font-medium text-gray-700">Correo de contacto</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="contacto@empresa.com"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      {error && <p className="mb-3 mt-3 text-sm text-red-600">{error}</p>}
      {savedMessage && <p className="mb-3 mt-3 text-sm text-green-700">{savedMessage}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
