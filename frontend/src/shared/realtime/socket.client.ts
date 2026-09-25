import { io, type Socket } from 'socket.io-client';

// Socket.IO conecta contra el origen del backend, no contra /api (eso es
// solo el prefijo de las rutas REST) — de ahí el replace.
const SOCKET_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '');

// Wrapper delgado sobre socket.io-client — namespace /conversations (el
// único que existe hoy, ver backend/features/conversations/services/
// conversation-realtime.service.ts). Dos formas de conectar con alcances muy
// distintos: staff con su JWT (ve todas las conversaciones) o un visitante
// anónimo del widget con el token de SU conversación (ve solo esa).
// Staff se autentica con la cookie httpOnly de sesión (withCredentials) — el
// JWT ya no es accesible desde JS, así que no se pasa por `auth`.
export function connectStaffSocket(): Socket {
  return io(`${SOCKET_URL}/conversations`, { auth: { role: 'staff' }, withCredentials: true });
}

export function connectContactSocket(conversationToken: string): Socket {
  return io(`${SOCKET_URL}/conversations`, { auth: { role: 'contact', token: conversationToken } });
}

// Namespace /team — chat interno de equipo (ver
// backend/features/team-chat/services/team-chat-realtime.service.ts). 100%
// staff, sin rol "contacto".
export function connectTeamSocket(): Socket {
  return io(`${SOCKET_URL}/team`, { withCredentials: true });
}
