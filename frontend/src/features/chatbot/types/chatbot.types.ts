export interface ChatbotTreeOption {
  texto: string;
  // Exactamente uno de los dos — nunca ambos, nunca ninguno (ver
  // ChatbotConfigController en el backend, que lo valida con Joi.xor).
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

export interface ChatbotConfig {
  activo: boolean;
  arbol: ChatbotTree;
  updatedAt: string | null;
}
