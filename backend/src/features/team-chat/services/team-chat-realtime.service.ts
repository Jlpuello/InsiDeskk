import { getSocketServer, verifySocketJwt } from '../../../shared/realtime/socket.server.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { teamChannelService } from './team-channel.service.js';
import { logger } from '../../../shared/utils/logger.js';

const NAMESPACE = '/team';
const channelRoom = (id: string): string => `team-channel:${id}`;

// 100% interno — solo JWT admin/tecnico, sin el rol "contacto" que sí tiene
// conversation-realtime.service.ts. Al conectar, el socket se une a la sala
// de CADA canal del que ya es miembro (si lo suman a uno nuevo mientras está
// conectado, no se une hasta reconectar — limitación conocida de v1).
export function registerTeamChatRealtime(): void {
  const io = getSocketServer();
  const nsp = io.of(NAMESPACE);

  nsp.use(async (socket, next) => {
    const { token } = socket.handshake.auth as { token?: string };
    const payload = token ? verifySocketJwt(token) : null;
    if (!payload || (payload.rol !== 'admin' && payload.rol !== 'tecnico')) {
      next(new Error('No autorizado'));
      return;
    }
    socket.data.userId = payload.id;
    next();
  });

  nsp.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    const channelIds = await teamChannelService.listChannelIdsForUser(userId);
    for (const channelId of channelIds) {
      void socket.join(channelRoom(channelId));
    }
  });

  // Puente entre el evento de dominio (Redis pub/sub) y la entrega en vivo —
  // mismo desacople que conversation-realtime.service.ts.
  void eventEmitter.on('team.message.created', (payload) => {
    nsp.to(channelRoom(payload.channelId)).emit('message', payload);
  });

  logger.info('Realtime de chat de equipo registrado');
}
