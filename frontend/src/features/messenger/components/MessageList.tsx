import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Avatar } from './Avatar.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { MOCK_USERS } from '../mockData.ts';
import { CURRENT_USER_ID, type Message } from '../types.ts';

interface MessageGroup {
  senderId: string;
  messages: Message[];
}

// Mensajes consecutivos del mismo remitente van juntos — así el nombre y el
// avatar se muestran una sola vez por grupo, no por mensaje.
function groupBySender(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const current = groups[groups.length - 1];
    if (current && current.senderId === message.senderId) {
      current.messages.push(message);
    } else {
      groups.push({ senderId: message.senderId, messages: [message] });
    }
  }
  return groups;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const groups = groupBySender(messages);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4" role="log" aria-live="polite" aria-label="Messages">
      {groups.map((group) => {
        const isOwn = group.senderId === CURRENT_USER_ID;
        const sender = MOCK_USERS[group.senderId];

        return (
          <div key={`${group.senderId}-${group.messages[0].id}`} className={clsx('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
            {sender && <span className="px-1 text-xs text-gray-500">{isOwn ? 'You' : sender.name}</span>}
            {group.messages.map((message, index) => (
              <div key={message.id} className={clsx('flex items-end gap-2', isOwn && 'flex-row-reverse')}>
                {index === 0 ? (
                  <Avatar initials={isOwn ? 'Y' : sender?.name.charAt(0).toUpperCase() || '?'} colorClass={isOwn ? 'bg-blue-600' : sender?.avatarColor || 'bg-gray-400'} size={32} />
                ) : (
                  <div className="w-8 shrink-0" aria-hidden="true" />
                )}
                <MessageBubble message={message} isOwn={isOwn} />
              </div>
            ))}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
