import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, MessageCircle, Search, Send } from 'lucide-react';
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

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

type MessageRenderItem =
  | { kind: 'divider'; id: string; label: string }
  | { kind: 'group'; id: string; role: 'own' | 'other'; authorId: string; authorLabel?: string | null; messages: ChatMessage[] };

// Agrupa mensajes consecutivos del mismo autor (y mismo día) en un solo
// bloque visual — un avatar/nombre por grupo en vez de uno por mensaje, con
// la hora solo en la última burbuja — más parecido a Slack/Intercom que a
// una lista de globos sueltos. Un canal grupal puede tener varios autores
// "other" seguidos (Ana, después Luis) — por eso agrupa por authorId, no
// solo por role, o los mezclaría bajo un solo nombre.
function buildMessageItems(
  messages: ChatMessage[],
  messageAuthorLabel?: (m: ChatMessage) => string | null | undefined,
): MessageRenderItem[] {
  const items: MessageRenderItem[] = [];
  let lastDay: string | null = null;

  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      items.push({ kind: 'divider', id: `divider-${m.id}`, label: dayLabel(m.createdAt) });
      lastDay = day;
    }

    const last = items[items.length - 1];
    if (last?.kind === 'group' && last.role === m.role && last.authorId === m.author.id) {
      last.messages.push(m);
    } else {
      items.push({
        kind: 'group',
        id: `group-${m.id}`,
        role: m.role,
        authorId: m.author.id,
        authorLabel: m.role === 'other' ? messageAuthorLabel?.(m) : null,
        messages: [m],
      });
    }
  }

  return items;
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
  // Botón "volver" en el header del hilo, visible solo en mobile (<sm) — ahí
  // la lista y el hilo activo ocupan la pantalla completa cada uno por
  // turnos (ver el toggle de visibilidad más abajo), así que hace falta una
  // forma de volver a la lista sin el grid de 2 columnas de desktop.
  onBack?: () => void;
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
  onBack,
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

  const messageItems = useMemo(() => buildMessageItems(messages, messageAuthorLabel), [messages, messageAuthorLabel]);

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
      {/* En mobile, lista y hilo activo ocupan la pantalla completa cada uno
          por turnos (no apilados, ver hallazgo del ui-reviewer) — de sm en
          adelante, el grid de 2 columnas vuelve a mostrar ambos siempre. */}
      <div className={clsx(active && 'hidden sm:block')}>
        <div className="mb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-300 bg-gray-50 py-1.5 pl-8 pr-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none"
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
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {loadingConversations ? (
          <div className="flex h-[62vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-300 shadow-sm">
              <MessageCircle size={16} />
            </span>
            <p className="text-sm text-gray-400">Cargando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[62vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-300 shadow-sm">
              {conversations.length === 0 ? <MessageCircle size={16} /> : <Search size={16} />}
            </span>
            <p className="px-6 text-center text-sm text-gray-400">
              {conversations.length === 0 ? emptyConversationsLabel : 'Sin resultados.'}
            </p>
          </div>
        ) : (
          // Mismo alto fijo que el panel del hilo (h-[62vh]) con scroll
          // interno propio — antes dependía del contenido y, con pocas
          // conversaciones, quedaba una card corta flotando con un vacío
          // enorme debajo del lado del hilo.
          <div className="h-[62vh] space-y-0.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
            {filtered.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <button
                  key={c.id}
                  onClick={() => onActiveConversationChange(c.id)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-md border-l-[3px] py-2 pl-2 pr-2.5 text-left transition-colors',
                    isActive ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-gray-50',
                  )}
                  style={!isActive && c.accentColor ? { borderLeftColor: c.accentColor } : undefined}
                >
                  <span
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      c.avatarIcon
                        ? 'bg-indigo-50 text-indigo-700'
                        : isActive
                          ? 'border border-blue-200 bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {c.avatarIcon ?? (c.avatarLabel ?? c.title).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={clsx(
                          'truncate text-sm',
                          c.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                          isActive && 'text-blue-700',
                        )}
                      >
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">{shortTime(c.updatedAt)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={clsx('truncate text-xs', c.unread ? 'font-medium text-gray-700' : 'text-gray-400')}>
                        {c.subtitle ?? 'Sin mensajes todavía'}
                      </span>
                      {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600 ring-2 ring-blue-100" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={clsx(!active && 'hidden sm:block')}>
        {!active && (
          <div className="flex h-[62vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-300 shadow-sm">
              <MessageCircle size={18} />
            </span>
            <p className="text-sm text-gray-400">{emptySelectionLabel}</p>
          </div>
        )}

        {active && (
          <div className="flex h-[62vh] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
            {/* flex-col -> flex-row en sm: en mobile son 2 filas SIEMPRE
                (predecible), no un flex-wrap automático de una sola fila —
                con flex-1 (flex-basis:0%) en el título, flex-wrap nunca
                decide saltar de línea (su hypothetical size de wrap es 0,
                "siempre cabe"), así que el título igual terminaba
                comprimido a 0 en la misma fila que las acciones. */}
            <div className="flex flex-col gap-2 rounded-t-lg border-b border-gray-200 bg-gradient-to-r from-blue-50/70 to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                {onBack && (
                  <button
                    onClick={onBack}
                    aria-label="Volver a la lista"
                    className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 sm:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <span
                  className={clsx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active.avatarIcon ? 'bg-indigo-50 text-indigo-700' : 'border border-blue-200 bg-blue-50 text-blue-700',
                  )}
                >
                  {active.avatarIcon ?? (active.avatarLabel ?? active.title).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-900">{active.title}</p>
                  {renderSubtitle?.(active)}
                </div>
              </div>
              {renderHeaderExtra?.(active)}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <p className="text-sm text-gray-400">Cargando mensajes...</p>
              ) : (
                messageItems.map((item) => {
                  if (item.kind === 'divider') {
                    return (
                      <div key={item.id} className="flex justify-center">
                        <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[11px] font-medium text-gray-400">
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  const isOther = item.role === 'other';
                  return (
                    <div key={item.id} className={clsx('flex gap-2', isOther ? 'justify-start' : 'justify-end')}>
                      {isOther && (
                        <span
                          className={clsx(
                            'mt-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                            active.avatarIcon ? 'bg-indigo-50 text-indigo-700' : 'border border-blue-200 bg-blue-50 text-blue-700',
                          )}
                        >
                          {item.authorLabel ? item.authorLabel.charAt(0).toUpperCase() : (active.avatarIcon ?? (active.avatarLabel ?? active.title).charAt(0).toUpperCase())}
                        </span>
                      )}
                      <div className={clsx('flex max-w-[68%] flex-col gap-0.5', !isOther && 'items-end')}>
                        {item.authorLabel && <p className="mb-0.5 text-xs font-semibold text-indigo-700">{item.authorLabel}</p>}
                        {item.messages.map((m, i) => {
                          const isLast = i === item.messages.length - 1;
                          return (
                            <div
                              key={m.id}
                              className={clsx(
                                'rounded-2xl px-3.5 py-2.5 text-sm',
                                isOther ? 'rounded-bl-sm border border-gray-200 bg-gray-100 text-gray-800' : 'rounded-br-sm bg-blue-600 text-white',
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.text}</p>
                              {isLast && (
                                <p className={clsx('mt-1 text-[10px]', isOther ? 'text-gray-400' : 'text-blue-100')}>
                                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 rounded-b-lg border-t border-gray-200 bg-gray-50/70 p-4">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={inputPlaceholder}
                disabled={inputDisabled || sending}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={inputDisabled || sending || !reply.trim()}
                aria-label="Enviar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
