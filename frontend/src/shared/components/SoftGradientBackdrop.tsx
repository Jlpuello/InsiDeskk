// Versión clara de PublicGradientBackdrop — para secciones con contenido
// denso (tarjetas, texto) donde el fondo oscuro con overlay negro de la
// landing/login no funcionaría (mataría el contraste de las tarjetas
// blancas). Mismo lenguaje de marca (azul), solo que como manchas suaves y
// desenfocadas detrás del contenido en vez de un gradiente sólido. El wash
// diagonal de base (from-blue-50 via-white to-indigo-50) evita que se vea
// blanco liso en los huecos entre manchas — antes eran demasiado tenues y
// la sección se sentía vacía pese a tener "fondo".
export function SoftGradientBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-200 opacity-60 blur-3xl" />
      <div className="absolute -right-20 top-1/4 h-[28rem] w-[28rem] rounded-full bg-indigo-100 opacity-60 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-blue-100 opacity-70 blur-3xl" />
    </div>
  );
}
