import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

// Modal genérico compartido — overlay + panel con header/body scrollable/
// footer opcional. Cierra con Escape o clic en el overlay (no al clickear
// adentro del panel, gracias al stopPropagation).
export function Modal({ title, subtitle, onClose, children, footer, headerActions, size = 'md' }: ModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className={clsx('flex max-h-[85vh] w-full flex-col rounded-lg bg-white shadow-xl', SIZE_CLASSES[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-1 rounded-md p-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4">{children}</div>

        {footer && <div className="shrink-0 border-t border-gray-200 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
