import { getSocketServer, verifySocketJwt } from '../../../shared/realtime/socket.server.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { conversationService } from './conversation.service.js';
import { logger } from '../../../shared/utils/logger.js';

const NAMESPACE = '/conversations';
const STAFF_ROOM = 'inbox:staff';
const conversationRoom = (id: string): string => `conversation:${id}`;

// Autenticación con DOS alcances muy distintos — no aflojar esto:
// - staff: JWT admin/tecnico → sala fija STAFF_ROOM, ve TODAS las
//   conversaciones (mismo criterio de acceso abierto que ya rige Tickets
//   entre técnicos).
// - contacto anónimo (widget /chat): el token de SU conversación (el mismo
//   que se genera en ConversationService.startPublic y guarda en
//   localStorage) → sala de ESA conversación puntual, nunca STAFF_ROOM. Sin
//   esto, cualquier visitante podría escuchar los mensajes de otras empresas.
export function registerConversationRealtime(): void {
  const io = getSocketServer();
  const nsp = io.of(NAMESPACE);

  nsp.use(async (socket, next) => {
    const { role, token } = socket.handshake.auth as { role?: string; token?: string };

    if (role === 'staff') {
      const payload = token ? verifySocketJwt(token) : null;
      if (!payload || (payload.rol !== 'admin' && payload.rol !== 'tecnico')) {
        next(new Error('No autorizado'));
        return;
      }
      socket.data.role = 'staff';
      next();
      return;
    }

    if (role === 'contact' && token) {
      try {
        const conversation = await conversationService.resolveByToken(token);
        socket.data.role = 'contact';
        socket.data.conversationId = conversation.id;
        next();
        return;
      } catch {
        next(new Error('Conversación no encontrada'));
        return;
      }
    }

    next(new Error('No autorizado'));
  });

  nsp.on('connection', (socket) => {
    if (socket.data.role === 'staff') {
      void socket.join(STAFF_ROOM);
    } else if (socket.data.role === 'contact') {
      void socket.join(conversationRoom(socket.data.conversationId as string));
    }
  });

  // Puente entre el evento de dominio (Redis pub/sub, lo emite
  // ConversationService sin saber nada de sockets) y la entrega en vivo.
  void eventEmitter.on('conversation.message.created', (payload) => {
    nsp.to(STAFF_ROOM).emit('message', payload);
    nsp.to(conversationRoom(payload.conversationId)).emit('message', payload);
  });

  logger.info('Realtime de conversaciones registrado');
}
