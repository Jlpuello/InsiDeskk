import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

interface ImagePickerProps {
  images: File[];
  onChange: (files: File[]) => void;
  maxImages?: number;
}

// Selector de fotos con miniaturas — usado donde hace falta adjuntar
// evidencia (cierre de ticket, completar una actividad). Las miniaturas se
// recalculan solo cuando cambia la lista de archivos (no en cada render del
// formulario padre), para no crear/perder blob URLs sin necesidad.
export function ImagePicker({ images, onChange, maxImages = 5 }: ImagePickerProps) {
  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    onChange([...images, ...Array.from(files)].slice(0, maxImages));
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={images.length >= maxImages}
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
      />

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative">
              <img
                src={previews[i]}
                alt={file.name}
                className="h-16 w-16 rounded-md border border-gray-200 object-cover"
              />
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
