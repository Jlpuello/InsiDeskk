// Validación de FORMATO nada más (solo dígitos, largo razonable) — no el
// algoritmo del dígito de verificación (DV) colombiano completo, que agrega
// complejidad sin aportar mucho para este caso de uso (atajar errores de
// tipeo en un formulario público, no certificar la validez legal del NIT).
export const NIT_FORMAT = /^\d{5,15}$/;

export function isValidNitFormat(nit: string): boolean {
  return NIT_FORMAT.test(nit.trim());
}

// El NIT guardado en Company a veces trae el dígito de verificación después
// de un guion ("900123456-7", formato que ya usaba CompaniesPage antes de
// este cambio) mientras que quien reporta desde /reportar, /chat o /soporte
// típicamente tipea solo el número base, sin el DV — el schema de esos
// formularios (NIT_FORMAT) ni siquiera permite un guion, así que "typed"
// nunca lo trae. Sin implementar el algoritmo real del dígito de
// verificación (ver comentario de arriba): si lo guardado tiene guion, alcanza
// con comparar contra la parte de antes; si no lo tiene, no hay forma segura
// de saber si el último dígito es el DV o no, así que se exige coincidencia
// exacta.
export function nitMatches(stored: string, typed: string): boolean {
  const digitsOnly = (v: string) => v.replace(/\D/g, '');
  if (digitsOnly(stored) === digitsOnly(typed)) return true;

  const hyphenIndex = stored.indexOf('-');
  if (hyphenIndex === -1) return false;
  return digitsOnly(stored.slice(0, hyphenIndex)) === digitsOnly(typed);
}
