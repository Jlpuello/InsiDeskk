import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import { Download, Hash, MessageCircle, MessageSquarePlus, Plus } from 'lucide-react';
import { conversationApi } from '../../features/conversations/api/conversation.api.ts';
import { teamChatApi } from '../../features/team-chat/api/team-chat.api.ts';
import { userApi } from '../../features/users/api/user.api.ts';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { connectStaffSocket, connectTeamSocket } from '../realtime/socket.client.ts';
import { Modal } from './Modal.tsx';
import { ChatBox, type ChatFilterOption } from './chat/ChatBox.tsx';
import { EXT_PREFIX, TEAM_PREFIX, type ChatAdapter, type ChatConversation, type ChatMessage } from './chat/chat.types.ts';
import type {
  ConversationMessage,
  ConversationMessageEvent,
  ConversationStatus,
  ConversationSummary,
} from '../../features/conversations/types/conversation.types.ts';
import type { TeamChannelSummary, TeamMessage, TeamMessageEvent } from '../../features/team-chat/types/team-chat.types.ts';
import type { UserSummary } from '../../features/users/types/user.types.ts';

const ESTADO_LABELS: Record<ConversationStatus, string> = { abierta: 'Abierta', cerrada: 'Cerrada' };

function toChatMessageExternal(m: ConversationMessage): ChatMessage {
  return {
    id: m.id,
    conversationId: EXT_PREFIX + m.conversationId,
    role: m.remitenteTipo === 'staff' ? 'own' : 'other',
    author: { id: m.remitenteUserId ?? 'contacto', displayName: m.remitenteUser?.nombre ?? 'Contacto' },
    text: m.contenido,
    createdAt: m.createdAt,
  };
}

function externalEventToChatMessage(payload: ConversationMessageEvent): ChatMessage {
  return {
    id: payload.messageId,
    conversationId: EXT_PREFIX + payload.conversationId,
    role: payload.remitenteTipo === 'staff' ? 'own' : 'other',
    author: { id: payload.remitenteTipo, displayName: payload.autorNombre },
    text: payload.contenido,
    createdAt: payload.createdAt,
  };
}

// Únicas dos funciones que necesitan saber "quién soy yo" — todo lo demás en
// este archivo es igual de genérico para ambas fuentes.
function toChatMessageTeam(m: TeamMessage, currentUserId?: string): ChatMessage {
  return {
    id: m.id,
    conversationId: TEAM_PREFIX + m.channelId,
    role: m.userId === currentUserId ? 'own' : 'other',
    author: { id: m.userId, displayName: m.user.nombre },
    text: m.contenido,
    createdAt: m.createdAt,
  };
}

function teamEventToChatMessage(payload: TeamMessageEvent, currentUserId?: string): ChatMessage {
  return {
    id: payload.messageId,
    conversationId: TEAM_PREFIX + payload.channelId,
    role: payload.autorId === currentUserId ? 'own' : 'other',
    author: { id: payload.autorId, displayName: payload.autorNombre },
    text: payload.contenido,
    createdAt: payload.createdAt,
  };
}

// Antes esto eran 3 pestañas (Bandeja/Mis conversaciones/Equipo) que se
// reemplazaban entera una a otra al cambiar — a pedido explícito, ahora es
// UN solo espacio: una sola lista combinada (conversaciones externas +
// DMs/canales de equipo) con chips para filtrar en vez de tabs, y el panel
// de la conversación activa nunca se desmonta al cambiar de filtro/buscar
// (ver el comentario de `filters` en ChatBox.tsx — la conversación activa se
// resuelve siempre contra la lista completa, no la filtrada).
export function MessagesPage() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [externalConversations, setExternalConversations] = useState<ConversationSummary[]>([]);
  const [teamChannels, setTeamChannels] = useState<TeamChannelSummary[]>([]);
  const [staff, setStaff] = useState<UserSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sendingInstaller, setSendingInstaller] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNombre, setGroupNombre] = useState('');
  const [groupMiembros, setGroupMiembros] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  function loadExternal() {
    return conversationApi.list().then(setExternalConversations).catch(() => setError('No se pudieron cargar las conversaciones'));
  }

  function loadTeam() {
    return teamChatApi.listChannels().then(setTeamChannels).catch(() => setError('No se pudieron cargar los canales'));
  }

  useEffect(() => {
    Promise.all([loadExternal(), loadTeam()]).finally(() => setLoadingList(false));
    userApi
      .list()
      .then((users) => setStaff(users.filter((u) => u.activo && u.rol !== 'cliente' && u.id !== currentUserId)))
      .catch(() => setStaff([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dos sockets en paralelo (externo + equipo) — cada uno solo actualiza su
  // propia lista y, si el mensaje es de la conversación abierta, el hilo.
  useEffect(() => {
    if (!currentUserId) return;
    const staffSocket = connectStaffSocket();
    const teamSocket = connectTeamSocket();

    staffSocket.on('message', (payload: ConversationMessageEvent) => {
      loadExternal();
      const id = EXT_PREFIX + payload.conversationId;
      if (id !== selectedIdRef.current) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.messageId) ? prev : [...prev, externalEventToChatMessage(payload)]));
    });

    teamSocket.on('message', (payload: TeamMessageEvent) => {
      loadTeam();
      const id = TEAM_PREFIX + payload.channelId;
      if (id !== selectedIdRef.current) return;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.messageId) ? prev : [...prev, teamEventToChatMessage(payload, currentUserId)],
      );
    });

    return () => {
      staffSocket.disconnect();
      teamSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Deep link desde el preview de MessagesIndicator (?c=ext:xxx / team:xxx) —
  // recién se puede resolver una vez que las listas terminaron de cargar, y
  // se limpia de la URL apenas se consume para que un refresh no reabra la
  // misma conversación sola ni un back del navegador quede pegado a ella.
  useEffect(() => {
    if (loadingList) return;
    const target = searchParams.get('c');
    if (!target) return;
    selectConversation(target);
    setSearchParams(
      (prev) => {
        prev.delete('c');
        return prev;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingList]);

  function findExternal(id: string): ConversationSummary | undefined {
    return externalConversations.find((c) => EXT_PREFIX + c.id === id);
  }

  function findTeam(id: string): TeamChannelSummary | undefined {
    return teamChannels.find((c) => TEAM_PREFIX + c.id === id);
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);

    if (id.startsWith(EXT_PREFIX)) {
      const realId = id.slice(EXT_PREFIX.length);
      conversationApi
        .getMessages(realId)
        .then(({ messages: msgs }) => {
          setMessages(msgs.map(toChatMessageExternal));
          setExternalConversations((prev) => prev.map((c) => (c.id === realId ? { ...c, tieneNoLeidos: false } : c)));
        })
        .catch(() => setError('No se pudo cargar la conversación'))
        .finally(() => setLoadingThread(false));
    } else {
      const realId = id.slice(TEAM_PREFIX.length);
      teamChatApi
        .getMessages(realId)
        .then((msgs) => {
          setMessages(msgs.map((m) => toChatMessageTeam(m, currentUserId)));
          setTeamChannels((prev) => prev.map((c) => (c.id === realId ? { ...c, noLeido: false } : c)));
        })
        .catch(() => setError('No se pudo cargar el canal'))
        .finally(() => setLoadingThread(false));
    }
  }

  async function handleSetEstado(realId: string, estado: ConversationStatus) {
    try {
      const updated = await conversationApi.setEstado(realId, estado);
      setExternalConversations((prev) => prev.map((c) => (c.id === realId ? updated : c)));
    } catch {
      setError('No se pudo cambiar el estado');
    }
  }

  // El mensaje con el link aparece solo en el hilo vía el socket de staff
  // (mismo eco deduplicado que cualquier respuesta normal) — no hace falta
  // tocar `messages` a mano acá.
  async function handleSendInstallerLink(realId: string) {
    setSendingInstaller(true);
    setError(null);
    try {
      await conversationApi.sendAgentInstallerLink(realId);
    } catch (err) {
      // El backend ya devuelve un mensaje puntual para cada causa real (sin
      // servidor de Remotely configurado, falta API_PUBLIC_URL, etc.) —
      // mostrarlo tal cual en vez de adivinar un genérico, que la última vez
      // terminó ocultando la causa real del error.
      const backendMessage = axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
      setError(backendMessage ?? 'No se pudo enviar el link');
    } finally {
      setSendingInstaller(false);
    }
  }

  async function handlePickDm(userId: string) {
    setCreating(true);
    try {
      const channel = await teamChatApi.getOrCreateDm(userId);
      setTeamChannels((prev) => [channel, ...prev.filter((c) => c.id !== channel.id)]);
      setShowDmPicker(false);
      selectConversation(TEAM_PREFIX + channel.id);
    } catch {
      setError('No se pudo iniciar el mensaje directo');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupNombre.trim() || groupMiembros.length === 0) return;

    setCreating(true);
    try {
      const channel = await teamChatApi.createGroup(groupNombre.trim(), groupMiembros);
      setTeamChannels((prev) => [channel, ...prev]);
      setShowGroupModal(false);
      setGroupNombre('');
      setGroupMiembros([]);
      selectConversation(TEAM_PREFIX + channel.id);
    } catch {
      setError('No se pudo crear el canal');
    } finally {
      setCreating(false);
    }
  }

  const adapter: ChatAdapter = {
    sendMessage: (id, text) => {
      if (id.startsWith(EXT_PREFIX)) {
        return conversationApi.postMessage(id.slice(EXT_PREFIX.length), text).then(toChatMessageExternal);
      }
      return teamChatApi.postMessage(id.slice(TEAM_PREFIX.length), text).then((m) => toChatMessageTeam(m, currentUserId));
    },
  };

  const chatConversations: ChatConversation[] = [
    ...externalConversations.map(
      (c): ChatConversation => ({
        id: EXT_PREFIX + c.id,
        title: c.contactoNombre,
        subtitle: c.empresa.nombre,
        // Ícono verde para distinguir de un vistazo un hilo de WhatsApp de
        // uno del widget de chat de /soporte — mismo lugar que ya usa `Hash`
        // para canales grupales de equipo.
        avatarIcon: c.canal === 'whatsapp' ? <MessageCircle size={15} className="text-green-600" /> : undefined,
        unread: c.tieneNoLeidos,
        updatedAt: c.ultimoMensajeEn,
      }),
    ),
    ...teamChannels.map(
      (c): ChatConversation => ({
        id: TEAM_PREFIX + c.id,
        title: c.nombre,
        subtitle: c.ultimoMensaje?.contenido,
        avatarIcon: c.tipo === 'grupo' ? <Hash size={15} /> : undefined,
        unread: c.noLeido,
        updatedAt: c.ultimoMensaje?.createdAt ?? c.updatedAt,
      }),
    ),
  ];

  const filters: ChatFilterOption[] = [
    { id: 'unread', label: 'No leídos', predicate: (c) => Boolean(c.unread) },
    { id: 'external', label: 'Externos', predicate: (c) => c.id.startsWith(EXT_PREFIX) },
    { id: 'team', label: 'Equipo', predicate: (c) => c.id.startsWith(TEAM_PREFIX) },
  ];

  const selectedExternal = selectedId ? findExternal(selectedId) : undefined;
  const selectedTeam = selectedId ? findTeam(selectedId) : undefined;

  if (loadingList) return <p className="p-6 text-gray-500">Cargando mensajes...</p>;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Mensajes</h1>
      <p className="mb-5 text-sm text-gray-500">
        Conversaciones con gente sin acceso al portal, mensajes directos y canales con tu equipo — todo en un solo lugar.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ChatBox
        conversations={chatConversations}
        activeConversationId={selectedId}
        onActiveConversationChange={selectConversation}
        messages={messages}
        loadingMessages={loadingThread}
        adapter={adapter}
        onMessageSent={(m) => setMessages((prev) => [...prev, m])}
        onSendError={() => setError('No se pudo enviar el mensaje')}
        searchPlaceholder="Buscar..."
        emptyConversationsLabel="Todavía no hay conversaciones."
        emptySelectionLabel="Elegí una conversación para ver los mensajes."
        filters={filters}
        inputDisabled={selectedExternal?.estado === 'cerrada'}
        inputPlaceholder={selectedExternal?.estado === 'cerrada' ? 'Conversación cerrada' : 'Escribí un mensaje...'}
        messageAuthorLabel={(m) => (selectedTeam?.tipo === 'grupo' ? m.author.displayName : null)}
        toolbarActions={
          <>
            <button
              onClick={() => setShowDmPicker(true)}
              title="Nueva conversación directa"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              title="Nuevo canal"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              <Plus size={16} />
            </button>
          </>
        }
        renderSubtitle={(c) => {
          const ext = findExternal(c.id);
          if (ext) {
            return (
              <p className="truncate text-xs text-gray-400">
                {ext.empresa.nombre} · {ext.contactoEmail ?? ext.contactoTelefono ?? 'sin contacto'}
              </p>
            );
          }
          const team = findTeam(c.id);
          if (team?.tipo === 'grupo') {
            return (
              <p className="truncate text-xs text-gray-400" title={team.miembros.map((m) => m.nombre).join(', ')}>
                {team.miembros.length} miembros
              </p>
            );
          }
          return null;
        }}
        renderHeaderExtra={(c) => {
          const ext = findExternal(c.id);
          if (!ext) return null;
          return (
            <div className="flex shrink-0 items-center gap-2">
              {!ext.contactoVerificado && (
                <span
                  title="Este contacto no coincide con ninguna cuenta, ticket o conversación previa de esta empresa — verificá antes de tratarlo como un pedido legítimo."
                  className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
                >
                  Contacto no verificado
                </span>
              )}
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  ext.estado === 'abierta' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
                )}
              >
                {ESTADO_LABELS[ext.estado]}
              </span>
              <button
                onClick={() => handleSendInstallerLink(ext.id)}
                disabled={sendingInstaller}
                title="Enviar link para instalar el agente de soporte remoto"
                className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={13} /> Enviar instalador
              </button>
              <button
                onClick={() => handleSetEstado(ext.id, ext.estado === 'abierta' ? 'cerrada' : 'abierta')}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {ext.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}
              </button>
            </div>
          );
        }}
      />

      {showDmPicker && (
        <Modal title="Mensaje directo" subtitle="Elegí con quién hablar" onClose={() => setShowDmPicker(false)} size="sm">
          <div className="space-y-1">
            {staff.length === 0 ? (
              <p className="text-sm text-gray-400">No hay otro staff disponible.</p>
            ) : (
              staff.map((u) => (
                <button
                  key={u.id}
                  disabled={creating}
                  onClick={() => handlePickDm(u.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                    {u.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.nombre}</span>
                    <span className="block truncate text-xs capitalize text-gray-400">{u.rol}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}

      {showGroupModal && (
        <Modal title="Nuevo canal" subtitle="Grupo de conversación con tu equipo" onClose={() => setShowGroupModal(false)} size="sm">
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre del canal</label>
              <input
                type="text"
                value={groupNombre}
                onChange={(e) => setGroupNombre(e.target.value)}
                required
                minLength={2}
                placeholder="ej. Soporte nivel 2"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Miembros</label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                {staff.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={groupMiembros.includes(u.id)}
                      onChange={(e) =>
                        setGroupMiembros((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id),
                        )
                      }
                      className="rounded border-gray-300"
                    />
                    {u.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !groupNombre.trim() || groupMiembros.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear canal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
