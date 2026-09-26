import { useEffect, useMemo } from 'react';
import { FileText, X } from 'lucide-react';

interface EvidenceFilePickerProps {
  images: File[];
  onChange: (files: File[]) => void;
  maxImages?: number;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPT =
  'image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Selector de evidencia (fotos o documentos) con miniaturas — usado donde
// hace falta documentar (cierre de ticket, completar una actividad). Las
// miniaturas de imagen se recalculan solo cuando cambia la lista de archivos
// (no en cada render del formulario padre), para no crear/perder blob URLs
// sin necesidad; los documentos no generan blob URL (no hay nada que
// previsualizar), solo se listan por nombre.
export function EvidenceFilePicker({ images, onChange, maxImages = 5 }: EvidenceFilePickerProps) {
  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    onChange([...images, ...Array.from(files)].slice(0, maxImages));
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  const previews = useMemo(
    () => images.map((file) => (IMAGE_TYPES.has(file.type) ? URL.createObjectURL(file) : null)),
    [images],
  );
  useEffect(() => {
    return () => previews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div>
      <input
        type="file"
        accept={ACCEPT}
        multiple
        disabled={images.length >= maxImages}
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
      />

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative">
              {previews[i] ? (
                <img
                  src={previews[i]!}
                  alt={file.name}
                  className="h-16 w-16 rounded-md border border-gray-200 object-cover"
                />
              ) : (
                <div
                  title={file.name}
                  className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1"
                >
                  <FileText size={18} className="shrink-0 text-gray-400" />
                  <span className="w-full truncate text-center text-[9px] text-gray-500">{file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-800 p-0.5 text-white hover:bg-gray-900"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
