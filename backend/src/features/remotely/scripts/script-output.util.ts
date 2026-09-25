import type { ExecuteScriptResult } from '../types/remotely.types.js';

// Compartido entre hardware-scan y network-scan: Remotely en modo WinPS
// alimenta el comando línea por línea a una consola interactiva, así que
// standardOutput trae de todo antes de la salida real — el eco del comando
// con su prompt, mensajes VERBOSE/DETALLADO (depende de $VerbosePreference de
// esa sesión), un GUID marcador. En vez de tratar de excluir cada tipo de
// ruido posible, se busca la línea que ES el JSON: nuestros scripts siempre
// terminan en ConvertTo-Json -Compress, que produce una sola línea que
// empieza con '{' y termina con '}' — se busca esa desde el final (la salida
// real siempre es lo último).
export function extractJsonLine(result: ExecuteScriptResult): string | null {
  const lines = result.standardOutput ?? [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }
  }
  return null;
}
