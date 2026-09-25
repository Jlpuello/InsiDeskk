import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { Message } from '../types.ts';
import { formatBubbleTime } from '../utils.ts';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

// Una sola burbuja — la agrupación por remitente consecutivo (y el avatar
// que solo aparece en el primer mensaje del grupo) vive en MessageList, no acá.
export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div className={clsx('max-w-[70%] rounded-lg px-3 py-2 text-sm', isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800')}>
      <p className="whitespace-pre-wrap break-words">{message.text}</p>
      <p className={clsx('mt-1 flex items-center justify-end gap-1 text-[10px]', isOwn ? 'text-blue-100' : 'text-gray-400')}>
        {isOwn && <Check size={12} className="text-white/70" aria-hidden="true" />}
        {formatBubbleTime(message.timestamp)}
      </p>
    </div>
  );
}
