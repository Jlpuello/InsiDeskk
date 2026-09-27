import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { authApi } from '../api/auth.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { PublicGradientBackdrop } from '../../../shared/components/PublicGradientBackdrop.tsx';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState('admin@empresa.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user } = await authApi.login(email, password);
      setSession(user);
      navigate('/tickets');
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 px-4">
      <PublicGradientBackdrop />

      <div className="relative z-10 w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-800">
            <Ticket size={19} />
          </span>
          <span className="leading-tight text-white">
            <span className="block text-base font-semibold">InsiDesk</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-blue-200">Mesa de ayuda</span>
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="w-full rounded-xl border border-white/10 bg-white p-8 shadow-xl">
          <h1 className="mb-6 text-lg font-semibold text-gray-900">Iniciar sesión</h1>

          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="mt-4 text-xs text-gray-500">
            Prueba con: admin@empresa.com / tecnico@empresa.com / cliente@empresa.com
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-blue-100">
          ¿Necesitás ayuda y no tenés cuenta?{' '}
          <Link to="/soporte" className="underline decoration-blue-300/50 hover:text-white">
            Pedir soporte
          </Link>
        </p>
      </div>
    </div>
  );
}
