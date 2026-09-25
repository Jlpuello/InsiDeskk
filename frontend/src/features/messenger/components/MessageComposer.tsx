import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Paperclip, SendHorizontal } from 'lucide-react';

interface MessageComposerProps {
  onSend: (text: string) => void;
}

export function MessageComposer({ onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-200 px-4 py-3">
      <button
        type="button"
        aria-label="Attach file"
        className="shrink-0 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Paperclip size={20} />
      </button>

      <div className="flex flex-1 items-center rounded-2xl border border-gray-300 px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a message"
          aria-label="Type a message"
          className="w-full border-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          canSend ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-blue-300',
        )}
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}
