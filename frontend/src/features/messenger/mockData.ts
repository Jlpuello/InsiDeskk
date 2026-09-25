import { CURRENT_USER_ID, type Conversation, type Message, type User } from './types.ts';

export const MOCK_USERS: Record<string, User> = {
  [CURRENT_USER_ID]: { id: CURRENT_USER_ID, name: 'You', avatarColor: 'bg-blue-600' },
  marco: { id: 'marco', name: 'Marco Diaz', avatarColor: 'bg-green-500' },
  priya: { id: 'priya', name: 'Priya Singh', avatarColor: 'bg-purple-500' },
  alice: { id: 'alice', name: 'Alice Chen', avatarColor: 'bg-orange-500' },
};

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'weekend-hiking',
    name: 'Weekend Hiking',
    isGroup: true,
    avatarInitials: 'WH',
    avatarColor: 'bg-teal-500',
    participantIds: ['marco', 'priya', 'alice'],
    unreadCount: 5,
  },
  {
    id: 'alice-chen',
    name: 'Alice Chen',
    isGroup: false,
    avatarInitials: 'AC',
    avatarColor: 'bg-orange-500',
    participantIds: ['alice'],
    unreadCount: 3,
  },
  {
    id: 'marco-diaz',
    name: 'Marco Diaz',
    isGroup: false,
    avatarInitials: 'MD',
    avatarColor: 'bg-green-500',
    participantIds: ['marco'],
    unreadCount: 3,
  },
];

// Minutos atrás desde "ahora" — así el chat grupal siempre se ve "de hoy"
// sin importar cuándo se abra la demo.
function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

export const MOCK_MESSAGES: Message[] = [
  // Weekend Hiking — Marco pregunta dos veces seguido (mismo grupo), Alice y
  // Priya responden cada una, Marco suma otra pregunta aparte, y cierro yo.
  { id: 'wh-1', conversationId: 'weekend-hiking', senderId: 'marco', text: 'How long is the full loop?', timestamp: minutesAgo(120) },
  { id: 'wh-2', conversationId: 'weekend-hiking', senderId: 'marco', text: 'Asking for my legs 😅', timestamp: minutesAgo(119) },
  { id: 'wh-3', conversationId: 'weekend-hiking', senderId: 'alice', text: 'Haha same question', timestamp: minutesAgo(90) },
  {
    id: 'wh-4',
    conversationId: 'weekend-hiking',
    senderId: 'priya',
    text: "I'll bring extra trail mix just in case 😄",
    timestamp: minutesAgo(60),
  },
  { id: 'wh-5', conversationId: 'weekend-hiking', senderId: 'marco', text: 'Should we bring a portable speaker?', timestamp: minutesAgo(30) },
  {
    id: 'wh-6',
    conversationId: 'weekend-hiking',
    senderId: CURRENT_USER_ID,
    text: 'Yes! I have one — charging it tonight 🔋',
    timestamp: minutesAgo(28),
  },

  // Alice Chen — fecha fija en el pasado para que la lista muestre "31 mar"
  // en vez de una hora (ver ConversationItem/formatListDate).
  { id: 'ac-1', conversationId: 'alice-chen', senderId: 'alice', text: 'Hey! Are we still on for Saturday?', timestamp: '2026-03-31T14:02:00.000Z' },
  { id: 'ac-2', conversationId: 'alice-chen', senderId: 'alice', text: 'I can bring the tent if needed', timestamp: '2026-03-31T14:03:00.000Z' },
  { id: 'ac-3', conversationId: 'alice-chen', senderId: CURRENT_USER_ID, text: 'Yes! Count me in 🙌', timestamp: '2026-03-31T14:10:00.000Z' },
  { id: 'ac-4', conversationId: 'alice-chen', senderId: 'alice', text: "Perfect, I'll send you the trail map", timestamp: '2026-03-31T14:12:00.000Z' },

  // Marco Diaz
  { id: 'md-1', conversationId: 'marco-diaz', senderId: 'marco', text: 'Did you check the weather forecast?', timestamp: minutesAgo(500) },
  { id: 'md-2', conversationId: 'marco-diaz', senderId: 'marco', text: 'Looks like it might rain a bit', timestamp: minutesAgo(499) },
  { id: 'md-3', conversationId: 'marco-diaz', senderId: CURRENT_USER_ID, text: "I'll bring a rain jacket just in case", timestamp: minutesAgo(480) },
];
