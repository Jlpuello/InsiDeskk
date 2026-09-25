import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';
import { jwtService, type JwtPayload } from '../auth/jwt.service.js';

let io: SocketIOServer | null = null;

// Genérico a propósito — shared/ no depende de ninguna feature (mismo
// criterio que shared/events/event.emitter.ts). Cada feature que necesite
// sockets arma su propio namespace/salas/autenticación usando `getSocketServer()`
// y, si necesita JWT, `verifySocketJwt()` — ver
// features/conversations/services/conversation-realtime.service.ts, el
// primer (y por ahora único) consumidor.
//
// Primera vez que la app empuja datos en vivo al navegador — todo lo demás
// (la campanita de notificaciones) es polling cada 30s. El adapter de Redis
// (mismo Redis que ya usa event.emitter.ts, conexiones ioredis dedicadas
// propias vía .duplicate()) hace que un mensaje emitido desde CUALQUIER
// instancia del backend llegue a los sockets conectados a CUALQUIER otra.
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  if (io) return io;

  const pubClient = new Redis({
    host: env.redisHost,
    port: env.redisPort,
    password: env.redisPassword || undefined,
    db: env.redisDb,
  });
  const subClient = pubClient.duplicate();
  pubClient.on('error', (err) => logger.error(`Socket.IO Redis pub error: ${err.message}`));
  subClient.on('error', (err) => logger.error(`Socket.IO Redis sub error: ${err.message}`));

  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin.split(','), credentials: true },
  });
  io.adapter(createAdapter(pubClient, subClient));

  logger.info('Socket.IO iniciado');
  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!io) throw new Error('Socket.IO no inicializado — llamar a initSocketServer() primero');
  return io;
}

// Mismo verifyToken que ya usa el middleware HTTP verifyJWT — reusable por
// cualquier feature que necesite un socket autenticado. No decide qué hacer
// con el resultado (a qué sala unir el socket, etc.), eso es de cada feature.
export function verifySocketJwt(token: string): JwtPayload | null {
  try {
    return jwtService.verifyToken(token);
  } catch {
    return null;
  }
}
