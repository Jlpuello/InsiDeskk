import clsx from 'clsx';
import { Avatar } from './Avatar.tsx';
import { MOCK_USERS } from '../mockData.ts';
import { CURRENT_USER_ID, type Conversation, type Message } from '../types.ts';
import { formatListDate } from '../utils.ts';

interface ConversationItemProps {
  conversation: Conversation;
  lastMessage?: Message;
  isSelected: boolean;
  onSelect: () => void;
}

export function ConversationItem({ conversation, lastMessage, isSelected, onSelect }: ConversationItemProps) {
  const senderLabel = lastMessage
    ? lastMessage.senderId === CURRENT_USER_ID
      ? 'You'
      : (MOCK_USERS[lastMessage.senderId]?.name.split(' ')[0] ?? null)
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={clsx(
        'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isSelected ? 'bg-gray-100' : 'hover:bg-gray-50',
      )}
    >
      <Avatar initials={conversation.avatarInitials} colorClass={conversation.avatarColor} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-gray-900">{conversation.name}</span>
          {lastMessage && <span className="shrink-0 text-xs text-gray-400">{formatListDate(lastMessage.timestamp)}</span>}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-gray-500">
            {senderLabel && <span>{senderLabel}: </span>}
            {lastMessage?.text ?? 'No messages yet'}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-medium text-white">
              {conversation.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
