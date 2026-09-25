import { useRef, useState, type PointerEvent } from 'react';

interface SignaturePadProps {
  onChange: (blob: Blob | null) => void;
}

// Firma dibujada con Pointer Events (funciona igual con mouse, touch y
// stylus) — el canvas tiene una resolución interna fija (400x150) que se
// escala por CSS, así que las coordenadas del puntero hay que reescalarlas
// a esa resolución interna en getPos, si no el trazo queda desalineado.
// Compartido entre actas de entrega y aprobación de cotizaciones — usado
// también en la página pública sin login de aprobación (no depende de auth).
export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    exportBlob();
  }

  function exportBlob() {
    canvasRef.current?.toBlob((blob) => onChange(blob), 'image/png');
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="h-[150px] w-full touch-none rounded-md border border-gray-300 bg-white"
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-gray-400">Firmá con el mouse, el dedo o un lápiz óptico</p>
        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:underline">
          Limpiar
        </button>
      </div>
    </div>
  );
}
