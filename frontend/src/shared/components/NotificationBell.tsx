import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import clsx from 'clsx';
import { notificationApi } from '../../features/notifications/api/notification.api.ts';
import type { AppNotification } from '../../features/notifications/types/notification.types.ts';

const POLL_MS = 30_000;

// Primer polling de la app (todo lo demás es fetch-on-mount o fetch-on-acción,
// no hay nada "en vivo" hoy) — no hay WebSocket/SSE armado, así que un
// setInterval liviano contra /notifications/mine/unread-count (un count(),
// barato) es el camino más simple que cumple. El panel recién pide la lista
// completa al abrirse, no en cada poll.
export function NotificationBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function refreshUnread() {
    notificationApi.unreadCount().then(setUnread).catch(() => {});
  }

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      notificationApi
        .listMine()
        .then(({ data }) => setItems(data))
        .finally(() => setLoading(false));
    }
  }

  async function handleClickItem(n: AppNotification) {
    if (!n.leida) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, leida: true } : i)));
      setUnread((c) => Math.max(0, c - 1));
      notificationApi.markRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, leida: true })));
    setUnread(0);
    await notificationApi.markAllRead().catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-label="Notificaciones"
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
            {items.some((i) => !i.leida) && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">Sin notificaciones.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={clsx(
                    'block w-full border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50',
                    !n.leida && 'bg-blue-50/50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.leida && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                    <div className={clsx('min-w-0', n.leida && 'pl-3.5')}>
                      <p className="truncate text-sm font-medium text-gray-900">{n.titulo}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{n.mensaje}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString('es-ES')}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
