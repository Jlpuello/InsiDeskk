export { ticketRoutes } from './ticket.routes.js';
export { publicTicketRoutes } from './public-ticket.routes.js';
export { TicketService, ticketService } from './services/ticket.service.js';
export type { CreateTicketDTO } from './services/ticket.service.js';
export { TicketRepository, ticketRepository } from './repositories/ticket.repository.js';
export { NoteRepository, noteRepository } from './repositories/note.repository.js';
export type { Ticket, TicketStatus, TicketPriority, Note, NoteType } from '@prisma/client';
