import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Check, Copy } from 'lucide-react';
import { accountApi } from '../api/account.api.ts';
import { Modal } from '../../../shared/components/Modal.tsx';
import type { AuthUser } from '../../auth/store/auth.store.ts';
import type { TwoFactorSetupResult } from '../types/account.types.ts';

interface TwoFactorSetupModalProps {
  onClose: () => void;
  onActivated: (user: AuthUser) => void;
}

function secretFromOtpauthUrl(otpauthUrl: string): string {
  try {
    return new URL(otpauthUrl).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

// Wizard de 2 pasos: 1) escanear QR + confirmar con el primer código real de
// la app, 2) mostrar los códigos de respaldo UNA sola vez (el backend no los
// vuelve a devolver nunca — se generan de nuevo recién si se desactiva y
// reactiva el 2FA). Separado de SecurityPage para no inflar ese archivo con
// el estado de los 2 pasos.
export function TwoFactorSetupModal({ onClose, onActivated }: TwoFactorSetupModalProps) {
  const [setup, setSetup] = useState<TwoFactorSetupResult | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    accountApi
      .setupTwoFactor()
      .then(setSetup)
      .catch(() => setError('No se pudo generar el código QR'))
      .finally(() => setLoading(false));
  }, []);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const result = await accountApi.verifyTwoFactor(code.trim());
      setBackupCodes(result.backupCodes);
      onActivated(result.user);
    } catch (err) {
      const backendMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(backendMessage ?? 'Código incorrecto');
    } finally {
      setVerifying(false);
    }
  }

  async function handleCopyBackupCodes() {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // El portapapeles puede fallar sin permiso/contexto no seguro — los
      // códigos ya están visibles y seleccionables a mano igual.
    }
  }

  function handleDownloadBackupCodes() {
    if (!backupCodes) return;
    const blob = new Blob([backupCodes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'insidesk-codigos-respaldo.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (backupCodes) {
    return (
      <Modal title="Guardá estos códigos de respaldo" onClose={onClose} size="sm">
        <p className="mb-3 text-sm text-gray-600">
          Si perdés el acceso a tu app autenticadora, cada uno de estos códigos te deja entrar una vez. No se vuelven a
          mostrar — guardalos en un lugar seguro antes de cerrar esto.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleCopyBackupCodes}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar todos'}
          </button>
          <button
            onClick={handleDownloadBackupCodes}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Descargar .txt
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ya los guardé
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Activar verificación en dos pasos" subtitle="Con una app autenticadora (Google Authenticator, Authy, etc.)" onClose={onClose} size="sm">
      {loading ? (
        <p className="text-sm text-gray-400">Generando código...</p>
      ) : setup ? (
        <>
          <p className="mb-3 text-sm text-gray-600">1. Escaneá este código con tu app autenticadora.</p>
          <img src={setup.qrCodeDataUrl} alt="Código QR para configurar 2FA" className="mx-auto mb-3 h-44 w-44" />
          <p className="mb-4 break-all text-center text-xs text-gray-400">
            ¿No podés escanear? Ingresá este código a mano: <span className="font-mono">{secretFromOtpauthUrl(setup.otpauthUrl)}</span>
          </p>

          <form onSubmit={handleVerify}>
            <p className="mb-2 text-sm text-gray-600">2. Ingresá el código de 6 dígitos que te muestra la app.</p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength={6}
              placeholder="000000"
              autoFocus
              className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-blue-500 focus:outline-none"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={verifying || code.trim().length !== 6}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {verifying ? 'Confirmando...' : 'Confirmar y activar'}
            </button>
          </form>
        </>
      ) : (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </Modal>
  );
}
