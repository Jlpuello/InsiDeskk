import type { Note } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';

export class NoteRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async findByTicketId(ticketId: string) {
    return this.prisma.note.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: safeUserSelect } },
    });
  }

  async create(data: {
    ticketId: string;
    usuarioId: string;
    contenido: string;
    tipo?: Note['tipo'];
    adjuntos?: string[];
  }) {
    return this.prisma.note.create({
      data,
      include: { usuario: { select: safeUserSelect } },
    });
  }

  async delete(ticketId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({ where: { id: noteId, ticketId } });
    if (!note) throw new NotFoundError('Nota');

    await this.prisma.note.delete({ where: { id: noteId } });
  }
}

export const noteRepository = new NoteRepository();
