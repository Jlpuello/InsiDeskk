import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Monitor } from 'lucide-react';
import { remotelyApi } from '../api/remotely.api.ts';
import type { StartSessionResult } from '../types/remotely.types.ts';

// Para equipos que NO están registrados en Inventario (walk-in, empresa
// default/sin contrato) — el contacto corrió el ejecutable portátil de
// Remotely (ver MessagesPage → "Enviar app de soporte") y le dictó al técnico
// el código que le muestra en pantalla. A diferencia de "Iniciar sesión
// remota" en Dispositivos (que arma una URL autenticada por sí sola, ver
// remotelyService.startSession), acá el link armado NO lleva OTP/accessKey
// propio — el navegador del técnico necesita tener su propia sesión de
// Remotely iniciada una vez (confirmado contra el código fuente de Remotely:
// el ejecutable portátil arma su link solo con sessionId, sin credenciales).
export function RemoteConnectPage() {
  const [sessionId, setSessionId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StartSessionResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sessionId.trim()) return;

    setConnecting(true);
    setError(null);
    setResult(null);
    try {
      const session = await remotelyApi.attendedConnect(sessionId.trim());
      setResult(session);
    } catch (err) {
      const backendMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(backendMessage ?? 'No se pudo armar la sesión');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Conexión remota</h1>
      <p className="mb-5 max-w-2xl text-sm text-gray-500">
        Conectate a un equipo que no está en Inventario (soporte puntual, empresa sin contrato) pidiéndole el código
        de sesión que le muestra la app portátil de Remotely — sin tener que entrar a Remotely a buscarlo.
      </p>

      <form onSubmit={handleSubmit} className="max-w-sm rounded-lg border border-gray-200 bg-white p-5">
        <label className="mb-1 block text-sm font-medium text-gray-700">Código de sesión</label>
        <input
          type="text"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          required
          autoFocus
          placeholder="ej. ABC123"
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={connecting || !sessionId.trim()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Monitor className="h-4 w-4" />
          {connecting ? 'Conectando...' : 'Conectar'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {result && (
          <a
            href={result.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-sm font-medium text-green-700 underline"
          >
            Abrir sesión remota →
          </a>
        )}
      </form>

      <p className="mt-4 max-w-sm text-xs text-gray-400">
        Si el link no conecta, asegurate de tener una sesión abierta en el propio panel de Remotely en este navegador
        — este código no trae credenciales propias, a diferencia de conectarse desde un dispositivo registrado.
      </p>
    </div>
  );
}
