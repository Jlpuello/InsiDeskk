import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ConversationList } from './ConversationList.tsx';
import { ChatHeader } from './ChatHeader.tsx';
import { MessageList } from './MessageList.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from '../mockData.ts';
import { CURRENT_USER_ID, type Conversation, type Message } from '../types.ts';

// Orquestador: dueño del estado (conversaciones/mensajes/selección), el resto
// de los componentes son controlados por props. Con datos mock por ahora —
// para conectar a una API real, alcanza con reemplazar los useState iniciales
// y handleSend por las llamadas correspondientes, la UI no cambia.
export function MessengerLayout() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const messagesByConversation = useMemo(() => {
    const map: Record<string, Message[]> = {};
    for (const message of messages) {
      (map[message.conversationId] ??= []).push(message);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [messages]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedMessages = selectedId ? (messagesByConversation[selectedId] ?? []) : [];

  function handleSelect(id: string) {
    setSelectedId(id);
    // Abrir la conversación la marca leída — mismo criterio que el resto de
    // la app (ver features/conversations y features/team-chat).
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
  }

  function handleSend(text: string) {
    if (!selectedId) return;
    const newMessage: Message = {
      id: `local-${Date.now()}`,
      conversationId: selectedId,
      senderId: CURRENT_USER_ID,
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden border border-gray-200 bg-white font-sans">
      {/* Lista: ocupa toda la pantalla en mobile mientras no haya selección;
          en md+ siempre visible con ancho fijo. */}
      <div
        className={clsx(
          'border-r border-gray-200 md:flex md:w-[300px] md:shrink-0',
          selectedId ? 'hidden md:flex' : 'flex w-full',
        )}
      >
        <ConversationList
          conversations={conversations}
          messagesByConversation={messagesByConversation}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat activo: pantalla completa en mobile solo cuando hay selección;
          en md+ siempre visible ocupando el resto del ancho. */}
      <div className={clsx('flex-col md:flex md:flex-1', selectedId ? 'flex w-full' : 'hidden md:flex')}>
        {selectedConversation ? (
          <>
            <ChatHeader
              conversation={selectedConversation}
              lastMessage={selectedMessages[selectedMessages.length - 1]}
              onBack={() => setSelectedId(null)}
            />
            <MessageList messages={selectedMessages} />
            <MessageComposer onSend={handleSend} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
