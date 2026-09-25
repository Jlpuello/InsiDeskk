import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { conversationApi } from '../../features/conversations/api/conversation.api.ts';
import { teamChatApi } from '../../features/team-chat/api/team-chat.api.ts';
import { connectStaffSocket, connectTeamSocket } from '../realtime/socket.client.ts';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';

// Suma el no-leído de las dos pestañas de /inbox (externos + equipo, ver
// MessagesPage.tsx) bajo un solo ícono — a diferencia de NotificationBell
// (polling cada 30s, no hay otra opción hoy), acá se actualiza EN VIVO por
// los dos sockets. Sin panel desplegable a propósito: /inbox ya es el lugar
// natural para revisar, un preview acá solo lo duplicaría.
export function MessagesIndicator() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const [externosUnread, setExternosUnread] = useState(0);
  const [equipoUnread, setEquipoUnread] = useState(0);

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
    });
    teamSocket.on('message', () => {
      teamChatApi.unreadCount().then(setEquipoUnread).catch(() => {});
    });

    return () => {
      staffSocket.disconnect();
      teamSocket.disconnect();
    };
  }, [userId]);

  const unread = externosUnread + equipoUnread;

  return (
    <button
      onClick={() => navigate('/inbox')}
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
  );
}
