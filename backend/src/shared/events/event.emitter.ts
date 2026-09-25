import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

// Payloads inline (no se importan tipos de features) para que shared/ no dependa
// de ninguna feature concreta — cualquier feature puede emitir o escuchar estos
// eventos sin crear un import cruzado.
export interface DomainEvents {
  // usuarioReporterId es null en tickets del formulario público (sin
  // cuenta) — ahí reporterEmail/reporterNombre traen el contacto en su
  // lugar (ver TicketService.createTicket).
  'ticket.created': {
    ticketId: string;
    usuarioReporterId: string | null;
    reporterNombre?: string | null;
    reporterEmail?: string | null;
    titulo: string;
  };
  'ticket.updated': { ticketId: string };
  // titulo/usuarioReporterId/usuarioAsignadoId van directo en el payload (no
  // solo el ticketId) porque quien emite ya tiene el ticket completo en
  // memoria — evita que el listener tenga que releerlo de la base. actorId
  // es quién disparó el cambio (getCurrentUserId() en ticket.service.ts) para
  // que el listener de notificaciones no le avise a la misma persona que lo
  // hizo; queda opcional porque algún disparo (ej. expiración automática de
  // una cotización) no tiene un usuario autenticado detrás.
  'ticket.status.changed': {
    ticketId: string;
    estado: string;
    titulo: string;
    usuarioReporterId: string | null;
    usuarioAsignadoId: string | null;
    actorId?: string;
  };
  'ticket.assigned': { ticketId: string; usuarioAsignadoId: string; titulo: string };
  // Notifica al aprobador designado cuando se le manda una cotización — ver
  // QuoteService.sendForApproval. Complementa el email que ya se manda (esto
  // es para el caso de que esté logueado en la app).
  'quote.sent': { quoteId: string; ticketId: string; ticketTitulo: string; aprobadorId: string };
  // Notifica al técnico que creó la cotización (creadoPorId) cuando el
  // aprobador resuelve o el token expira — ver QuoteService.
  'quote.resolved': {
    quoteId: string;
    ticketId: string;
    creadoPorId: string;
    ticketTitulo: string;
    estado: 'aprobado' | 'rechazado' | 'expirado';
  };
  'device.status.changed': {
    deviceId: string;
    remotelyDeviceId?: string;
    previousStatus: string;
    newStatus: string;
    timestamp: string;
  };
  // Puente hacia Socket.IO (ver shared/realtime/socket.server.ts) — el
  // emisor (ConversationService) no sabe nada de sockets, solo publica el
  // evento de dominio, igual que ticket.service.ts no sabe nada de
  // notificaciones. autorNombre ya viene resuelto (nombre del contacto o del
  // usuario staff) para que el listener no tenga que releerlo.
  'conversation.message.created': {
    messageId: string;
    conversationId: string;
    empresaId: string;
    remitenteTipo: 'contacto' | 'staff';
    contenido: string;
    autorNombre: string;
    createdAt: string;
  };
  // Chat interno de equipo (admin/tecnico entre ellos) — no confundir con
  // conversation.message.created (ahí uno de los dos lados es un contacto
  // externo). memberUserIds viaja en el payload para que el bridge de
  // sockets sepa a quién avisarle sin volver a consultar la base.
  'team.message.created': {
    messageId: string;
    channelId: string;
    memberUserIds: string[];
    autorId: string;
    autorNombre: string;
    contenido: string;
    createdAt: string;
  };
}

type EventName = keyof DomainEvents;
type Handler<E extends EventName> = (payload: DomainEvents[E]) => void | Promise<void>;

function redisConnectionOptions() {
  return {
    host: env.redisHost,
    port: env.redisPort,
    password: env.redisPassword || undefined,
    db: env.redisDb,
    lazyConnect: true,
  };
}

// Pub/sub sobre Redis (en vez de un EventEmitter nativo) para que los eventos de
// dominio funcionen igual si el backend corre en varias instancias.
class RedisEventEmitter {
  private readonly publisher = new Redis(redisConnectionOptions());
  private readonly subscriber = new Redis(redisConnectionOptions());
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor() {
    this.publisher.on('error', (err) => logger.error(`Redis publisher error: ${err.message}`));
    this.subscriber.on('error', (err) => logger.error(`Redis subscriber error: ${err.message}`));

    this.subscriber.on('message', (channel: string, message: string) => {
      const handlers = this.handlers.get(channel);
      if (!handlers) return;

      const payload = JSON.parse(message) as unknown;
      for (const handler of handlers) {
        Promise.resolve(handler(payload)).catch((err) =>
          logger.error(`Error en handler de "${channel}": ${(err as Error).message}`),
        );
      }
    });
  }

  async emit<E extends EventName>(event: E, payload: DomainEvents[E]): Promise<void> {
    await this.publisher.publish(event, JSON.stringify(payload));
  }

  async on<E extends EventName>(event: E, handler: Handler<E>): Promise<void> {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
      await this.subscriber.subscribe(event);
    }
    this.handlers.get(event)!.add(handler as (payload: unknown) => void);
  }

  async off<E extends EventName>(event: E, handler: Handler<E>): Promise<void> {
    this.handlers.get(event)?.delete(handler as (payload: unknown) => void);
  }

  async disconnect(): Promise<void> {
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }
}

export const eventEmitter = new RedisEventEmitter();
