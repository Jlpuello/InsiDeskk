import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Send } from 'lucide-react';
import type { ChatAdapter, ChatConversation, ChatMessage } from './chat.types.ts';

// Hoy (hora) / más viejo (fecha corta) — mismo criterio que Teams/Slack para
// el timestamp de la lista, más compacto que "hace 2h".
function shortTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export interface ChatFilterOption {
  id: string;
  label: string;
  predicate: (conversation: ChatConversation) => boolean;
}

interface ChatBoxProps {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onActiveConversationChange: (id: string) => void;
  messages: ChatMessage[];
  loadingConversations?: boolean;
  loadingMessages?: boolean;
  adapter: ChatAdapter;
  // El padre sigue siendo el dueño de `messages` (viene por prop, como
  // "controlled") — ChatBox solo avisa que se mandó/falló uno para que lo
  // agregue a su propio estado. Mismo espíritu que onMessagesChange del
  // ejemplo de @mui/x-chat, sin la parte de manejar el array acá adentro.
  onMessageSent?: (message: ChatMessage) => void;
  onSendError?: () => void;
  searchPlaceholder?: string;
  emptyConversationsLabel: string;
  emptySelectionLabel: string;
  // Botón(es) junto al buscador — ej. "+ Nuevo canal".
  toolbarActions?: ReactNode;
  // Chips debajo del buscador (ej. "Todo/No leídos/Externos/Equipo") — se
  // agrega automáticamente un "Todo" al principio. Filtran solo qué se
  // MUESTRA en la lista: la conversación activa se resuelve siempre contra
  // `conversations` completo, así que nunca desaparece del panel derecho por
  // cambiar de filtro o buscar algo que no la incluye.
  filters?: ChatFilterOption[];
  // Contenido a la derecha del header del hilo activo — ej. "Cerrar conversación".
  renderHeaderExtra?: (conversation: ChatConversation) => ReactNode;
  // Línea extra bajo el título en el header — ej. empresa/contacto, o cantidad de miembros.
  renderSubtitle?: (conversation: ChatConversation) => ReactNode;
  // Label a mostrar arriba de un mensaje ajeno (ej. nombre del autor en un
  // canal grupal) — null/undefined si no aplica.
  messageAuthorLabel?: (message: ChatMessage) => string | null | undefined;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
}

const ALL_FILTER_ID = '__all__';

// Única implementación visual de "lista de conversaciones + hilo + input" —
// inspirada en la forma de @mui/x-chat (adapter que solo sabe mandar
// mensajes, conversaciones/mensajes como datos, no como estado interno
// escondido) pero en Tailwind, sin esa dependencia (está en alpha y trae
// Material UI entero). Cada feature (conversaciones externas, DMs/canales de
// equipo) le pasa sus propios datos mapeados a ChatConversation/ChatMessage.
export function ChatBox({
  conversations,
  activeConversationId,
  onActiveConversationChange,
  messages,
  loadingConversations,
  loadingMessages,
  adapter,
  onMessageSent,
  onSendError,
  searchPlaceholder = 'Buscar...',
  emptyConversationsLabel,
  emptySelectionLabel,
  toolbarActions,
  filters,
  renderHeaderExtra,
  renderSubtitle,
  messageAuthorLabel,
  inputDisabled,
  inputPlaceholder = 'Escribí un mensaje...',
}: ChatBoxProps) {
  const [search, setSearch] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string>(ALL_FILTER_ID);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const allFilters = filters ? [{ id: ALL_FILTER_ID, label: 'Todo', predicate: () => true }, ...filters] : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activePredicate = allFilters?.find((f) => f.id === activeFilterId)?.predicate ?? (() => true);
    return conversations
      .filter(activePredicate)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search, activeFilterId]);

  // A propósito NO usa `filtered` — la conversación activa se tiene que
  // poder seguir viendo aunque el filtro/búsqueda actual la esconda de la
  // lista (ver comentario en `filters` más arriba).
  const active = conversations.find((c) => c.id === activeConversationId) ?? null;

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!active || !reply.trim()) return;

    setSending(true);
    try {
      const message = await adapter.sendMessage(active.id, reply.trim());
      onMessageSent?.(message);
      setReply('');
    } catch {
      onSendError?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[300px_1fr]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-xs focus:border-blue-700 focus:outline-none"
            />
          </div>
          {toolbarActions}
        </div>

        {allFilters && (
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar conversaciones">
            {allFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilterId(f.id)}
                aria-pressed={activeFilterId === f.id}
                className={clsx(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  activeFilterId === f.id
                    ? 'bg-blue-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loadingConversations ? (
          <p className="px-1 text-sm text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 text-sm text-slate-400">
            {conversations.length === 0 ? emptyConversationsLabel : 'Sin resultados.'}
          </p>
        ) : (
          <div className="space-y-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
            {filtered.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <button
                  key={c.id}
                  onClick={() => onActiveConversationChange(c.id)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      c.avatarIcon
                        ? 'bg-indigo-50 text-indigo-700'
                        : isActive
                          ? 'border border-blue-300 bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {c.avatarIcon ?? (c.avatarLabel ?? c.title).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={clsx(
                          'truncate text-sm',
                          c.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700',
                          isActive && 'text-blue-700',
                        )}
                      >
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{shortTime(c.updatedAt)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={clsx('truncate text-xs', c.unread ? 'font-medium text-slate-700' : 'text-slate-400')}>
                        {c.subtitle ?? 'Sin mensajes todavía'}
                      </span>
                      {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-700" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        {!active && <p className="text-sm text-slate-400">{emptySelectionLabel}</p>}

        {active && (
          <div className="flex h-[62vh] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active.avatarIcon ? 'bg-indigo-50 text-indigo-700' : 'border border-blue-300 bg-blue-50 text-blue-700',
                  )}
                >
                  {active.avatarIcon ?? (active.avatarLabel ?? active.title).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">{active.title}</p>
                  {renderSubtitle?.(active)}
                </div>
              </div>
              {renderHeaderExtra?.(active)}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <p className="text-sm text-slate-400">Cargando mensajes...</p>
              ) : (
                messages.map((m) => {
                  const authorLabel = m.role === 'other' ? messageAuthorLabel?.(m) : null;
                  return (
                    <div key={m.id} className={clsx('flex', m.role === 'own' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={clsx(
                          'max-w-[72%] rounded-lg px-3.5 py-2.5 text-sm',
                          m.role === 'own' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800',
                        )}
                      >
                        {authorLabel && <p className="mb-0.5 text-xs font-semibold text-indigo-700">{authorLabel}</p>}
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className={clsx('mt-1 text-[10px]', m.role === 'own' ? 'text-blue-100' : 'text-slate-400')}>
                          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 p-4">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={inputPlaceholder}
                disabled={inputDisabled || sending}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-blue-700 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={inputDisabled || sending || !reply.trim()}
                aria-label="Enviar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
