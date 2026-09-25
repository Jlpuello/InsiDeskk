// Validación de FORMATO nada más (solo dígitos, largo razonable) — no el
// algoritmo del dígito de verificación (DV) colombiano completo, que agrega
// complejidad sin aportar mucho para este caso de uso (atajar errores de
// tipeo en un formulario público, no certificar la validez legal del NIT).
export const NIT_FORMAT = /^\d{5,15}$/;

export function isValidNitFormat(nit: string): boolean {
  return NIT_FORMAT.test(nit.trim());
}
