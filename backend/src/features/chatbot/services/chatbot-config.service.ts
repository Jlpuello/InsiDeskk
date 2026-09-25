import { chatbotConfigRepository, type ChatbotTree } from '../repositories/chatbot-config.repository.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { logger } from '../../../shared/utils/logger.js';

export interface ChatbotConfigPublic {
  activo: boolean;
  arbol: ChatbotTree;
  updatedAt: string | null;
}

const EMPTY_TREE: ChatbotTree = {
  root: 'inicio',
  nodes: {
    inicio: {
      mensaje: '¡Hola! ¿En qué te podemos ayudar?',
      opciones: [{ texto: 'Reportar un problema', accion: 'crear_ticket' }],
    },
  },
};

export class ChatbotConfigService {
  async getForAdmin(): Promise<ChatbotConfigPublic> {
    const row = await chatbotConfigRepository.get();
    return {
      activo: row?.activo ?? false,
      arbol: (row?.arbol as unknown as ChatbotTree) ?? EMPTY_TREE,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  // El nodo raíz y cada `siguienteId` referenciado tienen que existir como
  // nodo — si no, el bot se queda "colgado" en producción sin forma de
  // detectarlo desde la UI del editor. Se valida acá (no en Joi, que no
  // puede expresar referencias cruzadas dentro del mismo objeto).
  private assertTreeIsConsistent(arbol: ChatbotTree): void {
    const nodeIds = Object.keys(arbol.nodes);
    if (!nodeIds.includes(arbol.root)) {
      throw new AppError(`El nodo raíz "${arbol.root}" no existe en el árbol`, 422);
    }
    for (const [nodeId, node] of Object.entries(arbol.nodes)) {
      for (const opcion of node.opciones) {
        if (opcion.siguienteId && !nodeIds.includes(opcion.siguienteId)) {
          throw new AppError(
            `La opción "${opcion.texto}" del nodo "${nodeId}" apunta a un nodo inexistente ("${opcion.siguienteId}")`,
            422,
          );
        }
      }
    }
  }

  async update(activo: boolean, arbol: ChatbotTree, updatedById: string): Promise<ChatbotConfigPublic> {
    this.assertTreeIsConsistent(arbol);

    const row = await chatbotConfigRepository.upsert(activo, arbol, updatedById);
    logger.info(`Árbol del chatbot actualizado por ${updatedById} (activo=${activo})`);

    return {
      activo: row.activo,
      arbol: row.arbol as unknown as ChatbotTree,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // Consumido por el endpoint público de la landing de soporte (Fase 2) — si
  // no está activo, no hay árbol que mostrar (el bot queda deshabilitado).
  async getForPublic(): Promise<ChatbotTree | null> {
    const row = await chatbotConfigRepository.get();
    if (!row?.activo) return null;
    return row.arbol as unknown as ChatbotTree;
  }
}

export const chatbotConfigService = new ChatbotConfigService();
