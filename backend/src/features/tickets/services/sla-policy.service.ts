import type { SlaPolicy, TicketCriticidad, TicketPriority } from '@prisma/client';
import { slaPolicyRepository } from '../repositories/sla-policy.repository.js';

const PRIORIDADES: TicketPriority[] = ['baja', 'media', 'alta', 'critica'];
const CRITICIDADES: TicketCriticidad[] = ['baja', 'media', 'alta', 'critica'];

// Valores de arranque (horas convertidas a minutos) — el admin los ajusta
// desde Configuración → SLA. Se usan solo para completar combinaciones que
// todavía no existan en la tabla (ver ensureSeeded), nunca pisan un valor ya
// guardado.
const HOURS: Record<TicketPriority, Record<TicketCriticidad, { respuesta: number; resolucion: number }>> = {
  baja: {
    baja: { respuesta: 24, resolucion: 120 },
    media: { respuesta: 24, resolucion: 96 },
    alta: { respuesta: 12, resolucion: 72 },
    critica: { respuesta: 8, resolucion: 48 },
  },
  media: {
    baja: { respuesta: 12, resolucion: 72 },
    media: { respuesta: 8, resolucion: 48 },
    alta: { respuesta: 4, resolucion: 24 },
    critica: { respuesta: 2, resolucion: 16 },
  },
  alta: {
    baja: { respuesta: 8, resolucion: 48 },
    media: { respuesta: 4, resolucion: 24 },
    alta: { respuesta: 2, resolucion: 12 },
    critica: { respuesta: 1, resolucion: 8 },
  },
  critica: {
    baja: { respuesta: 4, resolucion: 24 },
    media: { respuesta: 2, resolucion: 12 },
    alta: { respuesta: 1, resolucion: 6 },
    critica: { respuesta: 0.5, resolucion: 4 },
  },
};

export class SlaPolicyService {
  // Completa las combinaciones Prioridad×Criticidad que falten con los
  // valores por defecto de arriba — idempotente (createMany + skipDuplicates),
  // así que es seguro llamarlo en cada list()/getPolicy() sin pisar ediciones
  // del admin ya guardadas.
  async ensureSeeded(): Promise<void> {
    const existing = await slaPolicyRepository.findMany();
    const existingKeys = new Set(existing.map((e) => `${e.prioridad}:${e.criticidad}`));

    const missing = [];
    for (const prioridad of PRIORIDADES) {
      for (const criticidad of CRITICIDADES) {
        if (existingKeys.has(`${prioridad}:${criticidad}`)) continue;
        const { respuesta, resolucion } = HOURS[prioridad][criticidad];
        missing.push({
          prioridad,
          criticidad,
          tiempoRespuestaMin: Math.round(respuesta * 60),
          tiempoResolucionMin: Math.round(resolucion * 60),
        });
      }
    }

    if (missing.length > 0) await slaPolicyRepository.createMany(missing);
  }

  async list(): Promise<SlaPolicy[]> {
    await this.ensureSeeded();
    return slaPolicyRepository.findMany();
  }

  async getPolicy(prioridad: TicketPriority, criticidad: TicketCriticidad): Promise<SlaPolicy> {
    await this.ensureSeeded();
    const policy = await slaPolicyRepository.find(prioridad, criticidad);
    if (!policy) {
      // No debería pasar (ensureSeeded ya completó la matriz) — fallback
      // defensivo para no romper la creación de un ticket por esto.
      const { respuesta, resolucion } = HOURS[prioridad][criticidad];
      return {
        id: '',
        prioridad,
        criticidad,
        tiempoRespuestaMin: Math.round(respuesta * 60),
        tiempoResolucionMin: Math.round(resolucion * 60),
        updatedAt: new Date(),
      };
    }
    return policy;
  }

  async update(
    prioridad: TicketPriority,
    criticidad: TicketCriticidad,
    input: { tiempoRespuestaMin: number; tiempoResolucionMin: number },
  ): Promise<SlaPolicy> {
    await this.ensureSeeded();
    return slaPolicyRepository.upsert(prioridad, criticidad, input);
  }
}

export const slaPolicyService = new SlaPolicyService();
