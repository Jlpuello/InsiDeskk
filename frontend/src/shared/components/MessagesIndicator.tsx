import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Hash, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { conversationApi } from '../../features/conversations/api/conversation.api.ts';
import { teamChatApi } from '../../features/team-chat/api/team-chat.api.ts';
import { connectStaffSocket, connectTeamSocket } from '../realtime/socket.client.ts';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { EXT_PREFIX, TEAM_PREFIX } from './chat/chat.types.ts';

const PREVIEW_LIMIT = 6;

interface PreviewItem {
  id: string; // prefijado (ext:/team:), mismo formato que MessagesPage
  title: string;
  subtitle?: string;
  isTeam: boolean;
  unread: boolean;
  updatedAt: string;
}

// Antes este ícono solo navegaba a /inbox sin mostrar nada — a diferencia de
// NotificationBell, que sí muestra una vista previa al instante. Ahora abre
// el mismo tipo de desplegable: una lista corta (no leídos primero, después
// más recientes) que al clickear un ítem lleva a /inbox?c=<id> y
// MessagesPage lo abre directo (ver el efecto de deep link ahí) — ya no hace
// falta entrar a la bandeja completa y buscar la conversación a mano.
export function MessagesIndicator() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const [externosUnread, setExternosUnread] = useState(0);
  const [equipoUnread, setEquipoUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationApi.unreadCount().then(setExternosUnread).catch(() => {});
    teamChatApi.unreadCount().then(setEquipoUnread).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    const staffSocket = connectStaffSocket();
    const teamSocket = connectTeamSocket();

    staffSocket.on('message', () => {
      conversationApi.unreadCount().then(setExternosUnread).catch(() => {});
      // Si el desplegable está abierto, que se note en vivo (mismo criterio
      // que MessagesPage con sus propias listas) — si está cerrado, se
      // vuelve a pedir la próxima vez que se abra.
      setItems(null);
    });
    teamSocket.on('message', () => {
      teamChatApi.unreadCount().then(setEquipoUnread).catch(() => {});
      setItems(null);
    });

    return () => {
      staffSocket.disconnect();
      teamSocket.disconnect();
    };
  }, [userId]);

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
    if (next && items === null) {
      setLoading(true);
      Promise.all([conversationApi.list(), teamChatApi.listChannels()])
        .then(([conversations, channels]) => {
          const merged: PreviewItem[] = [
            ...conversations.map((c): PreviewItem => ({
              id: EXT_PREFIX + c.id,
              title: c.contactoNombre,
              subtitle: c.empresa.nombre,
              isTeam: false,
              unread: c.tieneNoLeidos,
              updatedAt: c.ultimoMensajeEn,
            })),
            ...channels.map((c): PreviewItem => ({
              id: TEAM_PREFIX + c.id,
              title: c.nombre,
              subtitle: c.ultimoMensaje?.contenido,
              isTeam: true,
              unread: c.noLeido,
              updatedAt: c.ultimoMensaje?.createdAt ?? c.updatedAt,
            })),
          ].sort((a, b) => {
            if (a.unread !== b.unread) return a.unread ? -1 : 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          setItems(merged.slice(0, PREVIEW_LIMIT));
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }

  function handleClickItem(id: string) {
    setOpen(false);
    navigate(`/inbox?c=${encodeURIComponent(id)}`);
  }

  const unread = externosUnread + equipoUnread;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-label="Mensajes"
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
      >
        <MessageCircle size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold text-gray-900">Mensajes</span>
            <button
              onClick={() => {
                setOpen(false);
                navigate('/inbox');
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Ver todos
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading || items === null ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-500">Sin conversaciones todavía.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClickItem(item.id)}
                  className={clsx(
                    'flex w-full items-start gap-2.5 border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50',
                    item.unread && 'bg-blue-50/50',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      item.isTeam ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {item.isTeam ? <Hash size={13} /> : item.title.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={clsx('truncate text-sm', item.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
                        {item.title}
                      </p>
                      {item.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                    </div>
                    <p className="truncate text-xs text-gray-500">{item.subtitle || 'Sin mensajes todavía'}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, locale: es })}
                    </p>
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
