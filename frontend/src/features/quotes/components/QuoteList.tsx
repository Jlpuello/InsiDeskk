import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { quoteApi } from '../api/quote.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Quote, QuoteEstado } from '../types/quote.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const ESTADO_LABELS: Record<QuoteEstado, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
  expirado: 'Expirada',
};

const ESTADO_STYLES: Record<QuoteEstado, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_aprobacion: 'bg-amber-100 text-amber-800',
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  expirado: 'bg-gray-100 text-gray-500',
};

function formatMoney(value: string): string {
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Filters {
  estado: string;
  empresaId: string;
}

const EMPTY_FILTERS: Filters = { estado: '', empresaId: '' };

// Vista general de cotizaciones — para ver en qué estado está cada una sin
// tener que entrar ticket por ticket (QuoteSection, embebido en el detalle
// del ticket, sigue siendo el lugar para crear/enviar una cotización nueva
// desde ahí mismo).
export function QuoteList() {
  const navigate = useNavigate();
  const rol = useAuthStore((state) => state.user?.rol);
  const isAdmin = rol === 'admin';

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(activeFilters: Filters) {
    setLoading(true);
    return quoteApi
      .list({
        estado: (activeFilters.estado || undefined) as QuoteEstado | undefined,
        empresaId: activeFilters.empresaId || undefined,
      })
      .then(setQuotes)
      .catch(() => setError('No se pudieron cargar las cotizaciones'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(EMPTY_FILTERS);
    if (isAdmin) {
      companyApi.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isAdmin]);

  function handleFilterChange(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next);
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cotizaciones</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filters.estado}
          onChange={(e) => handleFilterChange({ estado: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todo estado</option>
          {(Object.keys(ESTADO_LABELS) as QuoteEstado[]).map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={filters.empresaId}
            onChange={(e) => handleFilterChange({ empresaId: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">Toda empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
        {(filters.estado || filters.empresaId) && (
          <button onClick={() => handleFilterChange(EMPTY_FILTERS)} className="text-xs text-gray-500 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando cotizaciones...</p>
      ) : quotes.length === 0 ? (
        <p className="text-gray-500">No hay cotizaciones registradas.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Razón</th>
                {isAdmin && <th className="px-4 py-2">Empresa</th>}
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-2 text-gray-700">{q.ticket?.titulo ?? q.ticketId.slice(0, 8)}</td>
                  <td className="px-4 py-2 font-medium">{q.razon}</td>
                  {isAdmin && <td className="px-4 py-2 text-gray-500">{q.empresa?.nombre ?? '—'}</td>}
                  <td className="px-4 py-2 text-gray-500">{formatMoney(q.total)}</td>
                  <td className="px-4 py-2">
                    <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', ESTADO_STYLES[q.estado])}>
                      {ESTADO_LABELS[q.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{new Date(q.createdAt).toLocaleDateString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
