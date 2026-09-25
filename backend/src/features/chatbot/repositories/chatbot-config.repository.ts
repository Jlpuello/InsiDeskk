import type { ChatbotConfig } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

// Fila única — un solo árbol activo a la vez (alcance v1, ver plan).
const CONFIG_ID = 'singleton';

export interface ChatbotTreeOption {
  texto: string;
  siguienteId?: string;
  accion?: 'crear_ticket' | 'hablar_con_agente' | 'hablar_con_ia' | 'fin';
}

export interface ChatbotTreeNode {
  mensaje: string;
  opciones: ChatbotTreeOption[];
}

export interface ChatbotTree {
  root: string;
  nodes: Record<string, ChatbotTreeNode>;
}

export class ChatbotConfigRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async get(): Promise<ChatbotConfig | null> {
    return this.prisma.chatbotConfig.findUnique({ where: { id: CONFIG_ID } });
  }

  async upsert(activo: boolean, arbol: ChatbotTree, updatedById: string): Promise<ChatbotConfig> {
    return this.prisma.chatbotConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, activo, arbol: arbol as never, updatedById },
      update: { activo, arbol: arbol as never, updatedById },
    });
  }
}

export const chatbotConfigRepository = new ChatbotConfigRepository();
