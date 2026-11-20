import axios from 'axios';
import { logger } from '../../../shared/utils/logger.js';
import type { EffectiveAiConfig } from '../../settings/services/platform-settings.service.js';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Forma canónica de una tool — el service la traduce al formato que espera
// cada proveedor (Anthropic: input_schema; OpenAI: function.parameters).
export interface AiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface AiChatResult {
  // Texto para mostrarle al usuario — ausente si el modelo solo devolvió un
  // tool call sin comentario.
  text?: string;
  // La IA nunca ejecuta nada ella misma (ver conversationService/floating
  // widget) — esto es una INTENCIÓN que el frontend usa para precargar un
  // flujo ya existente y protegido (crear ticket / derivar a agente).
  toolCall?: { name: string; input: Record<string, unknown> };
}

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 1024;

export class AiClientService {
  async chat(config: EffectiveAiConfig, systemPrompt: string, messages: AiChatMessage[], tools: AiTool[]): Promise<AiChatResult> {
    try {
      if (config.provider === 'anthropic') return await this.chatAnthropic(config, systemPrompt, messages, tools);
      if (config.provider === 'openai') return await this.chatOpenai(config, systemPrompt, messages, tools);
      if (config.provider === 'gemini') return await this.chatGemini(config, systemPrompt, messages, tools);
      throw new Error(`Proveedor de IA desconocido: ${config.provider}`);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : (err as Error).message;
      logger.error(`Error llamando al proveedor de IA (${config.provider}): ${detail}`);
      throw err;
    }
  }

  private async chatAnthropic(
    config: EffectiveAiConfig,
    systemPrompt: string,
    messages: AiChatMessage[],
    tools: AiTool[],
  ): Promise<AiChatResult> {
    const { data } = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: config.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      },
      {
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
      },
    );

    const blocks = (data.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
    const textBlock = blocks.find((b) => b.type === 'text');
    const toolBlock = blocks.find((b) => b.type === 'tool_use');

    return {
      text: textBlock?.text,
      ...(toolBlock && { toolCall: { name: toolBlock.name!, input: toolBlock.input ?? {} } }),
    };
  }

  private async chatOpenai(
    config: EffectiveAiConfig,
    systemPrompt: string,
    messages: AiChatMessage[],
    tools: AiTool[],
  ): Promise<AiChatResult> {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: config.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
        tool_choice: 'auto',
      },
      { headers: { Authorization: `Bearer ${config.apiKey}` } },
    );

    const message = data.choices?.[0]?.message ?? {};
    const toolCall = message.tool_calls?.[0];

    return {
      text: message.content ?? undefined,
      ...(toolCall && {
        toolCall: { name: toolCall.function.name, input: JSON.parse(toolCall.function.arguments || '{}') },
      }),
    };
  }

  // Formato propio de Gemini (ver ai.google.dev/api/generate-content):
  // "contents[].role" es "user"/"model" (no "assistant"), el system prompt va
  // aparte en "systemInstruction", y las tools van envueltas en un único
  // elemento "functionDeclarations" (no un array de {type, function} como
  // OpenAI). Auth por header x-goog-api-key, no Bearer.
  private async chatGemini(
    config: EffectiveAiConfig,
    systemPrompt: string,
    messages: AiChatMessage[],
    tools: AiTool[],
  ): Promise<AiChatResult> {
    const { data } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      {
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ...(tools.length > 0 && {
          tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        }),
      },
      { headers: { 'x-goog-api-key': config.apiKey, 'Content-Type': 'application/json' } },
    );

    const parts = (data.candidates?.[0]?.content?.parts ?? []) as {
      text?: string;
      functionCall?: { name: string; args?: Record<string, unknown> };
    }[];
    const textPart = parts.find((p) => p.text !== undefined);
    const functionCallPart = parts.find((p) => p.functionCall);

    return {
      text: textPart?.text,
      ...(functionCallPart?.functionCall && {
        toolCall: { name: functionCallPart.functionCall.name, input: functionCallPart.functionCall.args ?? {} },
      }),
    };
  }
}

export const aiClientService = new AiClientService();
