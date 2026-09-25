import { ArrowLeft } from 'lucide-react';
import { Avatar } from './Avatar.tsx';
import { MOCK_USERS } from '../mockData.ts';
import { CURRENT_USER_ID, type Conversation, type Message } from '../types.ts';

interface ChatHeaderProps {
  conversation: Conversation;
  lastMessage?: Message;
  onBack: () => void;
}

export function ChatHeader({ conversation, lastMessage, onBack }: ChatHeaderProps) {
  const senderLabel = lastMessage
    ? lastMessage.senderId === CURRENT_USER_ID
      ? 'You'
      : (MOCK_USERS[lastMessage.senderId]?.name.split(' ')[0] ?? null)
    : null;

  return (
    <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        className="-ml-1 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
      >
        <ArrowLeft size={20} />
      </button>
      <Avatar initials={conversation.avatarInitials} colorClass={conversation.avatarColor} size={36} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-gray-900">{conversation.name}</p>
        {lastMessage && (
          <p className="truncate text-xs text-gray-500">
            {senderLabel && <span>{senderLabel}: </span>}
            {lastMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
