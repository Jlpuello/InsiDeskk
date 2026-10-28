import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { accountApi } from '../api/account.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { ConfirmModal } from '../../../shared/components/ConfirmModal.tsx';
import { TwoFactorSetupModal } from './TwoFactorSetupModal.tsx';
import type { SecurityStatus } from '../types/account.types.ts';

const RAZON_LABELS: Record<string, string> = {
  usuario_no_existe: 'Email no registrado',
  usuario_inactivo: 'Usuario deshabilitado',
  password_incorrecto: 'Contraseña incorrecta',
  codigo_2fa_incorrecto: 'Código de verificación incorrecto',
};

function backendErrorMessage(err: unknown, fallback: string): string {
  return axios.isAxiosError(err) ? ((err.response?.data as { error?: string } | undefined)?.error ?? fallback) : fallback;
}

export function SecurityPage() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);

  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showSetup, setShowSetup] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeDone, setRevokeDone] = useState(false);

  function loadStatus() {
    accountApi
      .getSecurity()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }

  useEffect(loadStatus, []);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmación no coincide con la nueva contraseña');
      return;
    }

    setSavingPassword(true);
    try {
      const updated = await accountApi.changePassword(currentPassword, newPassword);
      setSession(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(backendErrorMessage(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDisableTwoFactor(e: FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisabling(true);
    try {
      const updated = await accountApi.disableTwoFactor(disablePassword);
      setSession(updated);
      setDisablePassword('');
      loadStatus();
    } catch (err) {
      setDisableError(backendErrorMessage(err, 'No se pudo desactivar'));
    } finally {
      setDisabling(false);
    }
  }

  async function handleRevokeOthers() {
    setRevoking(true);
    try {
      const updated = await accountApi.revokeOtherSessions();
      setSession(updated);
      setRevokeDone(true);
    } catch {
      // silencioso — no es crítico que falle, el usuario puede reintentar
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Seguridad</h1>
      <p className="mb-6 text-sm text-gray-500">Contraseña, verificación en dos pasos y sesiones de tu cuenta.</p>

      {status?.twoFactorRequired && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Tu rol exige verificación en dos pasos activa. Configurala abajo para poder seguir usando el resto de la
            plataforma.
          </p>
        </div>
      )}

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Contraseña</h2>
        <form onSubmit={handleChangePassword}>
          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña actual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña nueva</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="mb-4 text-xs text-gray-400">Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.</p>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar contraseña nueva</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {passwordError && <p className="mb-3 text-sm text-red-600">{passwordError}</p>}
          {passwordSaved && <p className="mb-3 text-sm text-green-700">Contraseña actualizada.</p>}

          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Verificación en dos pasos</h2>
          {loadingStatus ? null : status?.twoFactorEnabled ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 size={14} /> Activa
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <XCircle size={14} /> Inactiva
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-gray-400">
          Pide un código de tu app autenticadora (Google Authenticator, Authy, etc.) además de tu contraseña al iniciar
          sesión.
        </p>

        {status?.twoFactorEnabled ? (
          user.rol === 'admin' ? (
            <p className="text-sm text-gray-500">Tu rol exige tenerla activa — no se puede desactivar.</p>
          ) : (
            <form onSubmit={handleDisableTwoFactor} className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña actual (para desactivar)</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {disableError && <p className="mb-3 text-sm text-red-600">{disableError}</p>}
              <button
                type="submit"
                disabled={disabling}
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {disabling ? 'Desactivando...' : 'Desactivar'}
              </button>
            </form>
          )
        ) : (
          <button
            onClick={() => setShowSetup(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Activar
          </button>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Sesiones</h2>
        <p className="mb-4 text-xs text-gray-400">
          Cierra tu sesión en cualquier otro navegador o dispositivo donde hayas iniciado sesión — esta pantalla sigue
          abierta.
        </p>
        {revokeDone && <p className="mb-3 text-sm text-green-700">Listo — tus otras sesiones ya no están activas.</p>}
        <button
          onClick={() => setShowRevokeConfirm(true)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cerrar sesión en otros dispositivos
        </button>
      </section>

      {status && status.recentFailedAttempts.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Intentos de acceso recientes</h2>
          <div className="space-y-1.5">
            {status.recentFailedAttempts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{RAZON_LABELS[a.razon] ?? a.razon}</span>
                <span className="text-gray-400">{new Date(a.createdAt).toLocaleString('es-ES')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showSetup && (
        <TwoFactorSetupModal
          onClose={() => {
            setShowSetup(false);
            loadStatus();
          }}
          onActivated={(updatedUser) => setSession(updatedUser)}
        />
      )}

      {showRevokeConfirm && (
        <ConfirmModal
          title="Cerrar otras sesiones"
          message="Vas a cerrar tu sesión en cualquier otro navegador o dispositivo. Esta pantalla sigue abierta."
          confirmLabel={revoking ? 'Cerrando...' : 'Cerrar otras sesiones'}
          confirmClassName="bg-blue-600 hover:bg-blue-700"
          onClose={() => setShowRevokeConfirm(false)}
          onConfirm={handleRevokeOthers}
        />
      )}
    </div>
  );
}
