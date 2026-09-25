import { useRef, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { documentDisplayName, quoteApi } from '../api/quote.api.ts';
import type { Quote } from '../types/quote.types.ts';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';

interface QuoteDocumentsProps {
  quote: Quote;
  canManage: boolean;
  onChange: (quote: Quote) => void;
}

// Documentos de soporte (cotización del proveedor, ficha técnica, fotos del
// repuesto) — se pueden sumar en cualquier estado de la cotización, no solo
// en borrador (ver QuoteService.addDocuments). Solo admin/técnico suben o
// borran; cualquiera de la misma empresa puede descargar.
export function QuoteDocuments({ quote, canManage, onChange }: QuoteDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await quoteApi.uploadDocuments(quote.id, Array.from(files));
      onChange(updated);
    } catch {
      setError('No se pudo subir el archivo — revisá el formato (PDF, Word, Excel o imagen) y el tamaño (máx. 10MB)');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove(url: string) {
    setRemovingUrl(url);
    try {
      const updated = await quoteApi.removeDocument(quote.id, url);
      onChange(updated);
    } catch {
      setError('No se pudo eliminar el documento');
    } finally {
      setRemovingUrl(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Documentos</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            <Upload size={14} />
            {uploading ? 'Subiendo...' : 'Subir documento'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {quote.documentos.length === 0 ? (
        <p className="text-sm text-gray-500">Sin documentos adjuntos.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {quote.documentos.map((url) => (
            <li key={url} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                <FileText size={14} className="shrink-0 text-gray-400" />
                <span className="truncate">{documentDisplayName(url)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => quoteApi.downloadDocument(url)}
                  className="text-gray-400 hover:text-blue-600"
                  title="Descargar"
                >
                  <Download size={14} />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(url)}
                    disabled={removingUrl === url}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
