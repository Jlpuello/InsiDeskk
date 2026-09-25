import type { TicketLevelVisibility } from '@prisma/client';
import { ticketLevelVisibilityRepository } from '../repositories/ticket-level-visibility.repository.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CachePatterns } from '../../../shared/cache/cache-keys.js';

const NIVELES = [1, 2, 3];
const CACHE_KEY = 'ticket-level-visibility:matrix';
// Se lee en CADA listado de tickets de un técnico (ver
// TicketService.getTickets) — TTL corto en vez de sin cache, para no
// pegarle a Postgres en cada carga de la lista; se invalida de una al
// guardar (ver update()), así que la ventana de 60s solo importa si dos
// admins lo editan casi al mismo tiempo desde instancias de proceso
// distintas.
const CACHE_TTL = 60;

export class TicketLevelVisibilityService {
  // Devuelve solo las filas guardadas — completar "visible: true" para las
  // combinaciones ausentes es responsabilidad de quien consume esto (acá y
  // en el frontend), no se pre-siembra la tabla entera como SlaPolicy.
  async list(): Promise<TicketLevelVisibility[]> {
    const cached = await cacheService.get<TicketLevelVisibility[]>(CACHE_KEY);
    if (cached) return cached;

    const rows = await ticketLevelVisibilityRepository.findMany();
    await cacheService.set(CACHE_KEY, rows, CACHE_TTL);
    return rows;
  }

  async update(nivelTecnico: number, nivelTicket: number, visible: boolean): Promise<TicketLevelVisibility> {
    if (!NIVELES.includes(nivelTecnico) || !NIVELES.includes(nivelTicket)) {
      throw new Error('Nivel inválido — debe ser 1, 2 o 3');
    }

    const row = await ticketLevelVisibilityRepository.upsert(nivelTecnico, nivelTicket, visible);

    await cacheService.delete(CACHE_KEY);
    // La matriz cambió: cualquier lista de tickets ya cacheada para algún
    // técnico puede estar reflejando la política vieja — se invalida entera
    // en vez de intentar calcular a quién afecta (cambio poco frecuente,
    // invalidar de más acá sale barato).
    await cacheService.invalidatePattern(CachePatterns.allTicketLists);

    return row;
  }

  // Niveles de TICKET que un técnico de este nivel NO debe ver al navegar la
  // lista general — filas ausentes de la matriz son "visible", así que solo
  // entran acá las que el admin marcó explícitamente en false.
  async getDeniedTicketNiveles(nivelTecnico: number): Promise<number[]> {
    const rows = await this.list();
    return rows
      .filter((r) => r.nivelTecnico === nivelTecnico && !r.visible)
      .map((r) => r.nivelTicket)
      .sort((a, b) => a - b);
  }
}

export const ticketLevelVisibilityService = new TicketLevelVisibilityService();
