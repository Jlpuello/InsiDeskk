import { useState } from 'react';
import clsx from 'clsx';
import { MoreVertical, PlusSquare, Search } from 'lucide-react';
import { ConversationItem } from './ConversationItem.tsx';
import type { Conversation, Message } from '../types.ts';

type FilterId = 'all' | 'unread' | 'groups';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'groups', label: 'Groups' },
];

interface ConversationListProps {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, messagesByConversation, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  const query = search.trim().toLowerCase();
  const filtered = conversations.filter((c) => {
    if (filter === 'unread' && c.unreadCount === 0) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    if (query && !c.name.toLowerCase().includes(query)) return false;
    return true;
  });

  function lastMessageOf(conversationId: string): Message | undefined {
    const msgs = messagesByConversation[conversationId];
    return msgs?.[msgs.length - 1];
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="New chat"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <PlusSquare size={20} />
          </button>
          <button
            type="button"
            aria-label="More options"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search or start a new chat"
            className="w-full rounded-full bg-gray-100 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-3" role="group" aria-label="Filter conversations">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              filter === id ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-gray-400">No conversations found.</p>
        ) : (
          filtered.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              lastMessage={lastMessageOf(c.id)}
              isSelected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
