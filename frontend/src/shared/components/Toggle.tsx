import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

// Switch genérico chico — pensado para listas (activo/inactivo, sí/no) donde
// un botón con texto ("Activo"/"Desactivar") ocupa más y se lee menos de un
// vistazo. onChange no recibe el valor nuevo a propósito: quien lo usa ya
// sabe qué significa togglear desde su propio estado (`checked`), y muchos
// casos necesitan interceptar el click (ej. pedir motivo) en vez de aplicar
// el cambio directo.
export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-600' : 'bg-gray-300',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
