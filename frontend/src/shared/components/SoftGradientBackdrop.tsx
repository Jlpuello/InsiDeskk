// Versión clara de PublicGradientBackdrop — para secciones con contenido
// denso (tarjetas, texto) donde el fondo oscuro con overlay negro de la
// landing/login no funcionaría (mataría el contraste de las tarjetas
// blancas). Mismo lenguaje de marca (azul), solo que como manchas suaves y
// desenfocadas detrás del contenido en vez de un gradiente sólido.
export function SoftGradientBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-100 opacity-70 blur-3xl" />
      <div className="absolute -right-16 top-1/3 h-80 w-80 rounded-full bg-indigo-50 opacity-70 blur-3xl" />
      <div className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-blue-50 opacity-80 blur-3xl" />
    </div>
  );
}
