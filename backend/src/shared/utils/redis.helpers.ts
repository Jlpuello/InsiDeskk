export function buildCacheKey(...parts: Array<string | number>): string {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(':');
}

export function ttlSeconds(seconds: number): number {
  return Math.max(1, Math.floor(seconds));
}

// Produce una key determinística para un objeto de filtros, sin importar el
// orden de sus propiedades (a diferencia de JSON.stringify directo).
export function hashFilters(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.length > 0 ? entries.map(([key, value]) => `${key}=${String(value)}`).join('&') : 'all';
}
