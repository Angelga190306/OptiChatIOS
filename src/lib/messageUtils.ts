import { Message } from '../types';

export const createClientId = (now = Date.now, random = Math.random) =>
  `${now()}-${random().toString(36).slice(2)}-${random().toString(36).slice(2)}`;

export const getMessageId = (message: Message) => message._id || message.id || message.clientMessageId || '';

export const mergeMessageLists = (current: Message[], incoming: Message[]) => {
  const map = new Map<string, Message>();
  for (const message of [...current, ...incoming]) {
    const optimistic = message.clientMessageId
      ? [...map.entries()].find(([, value]) => value.clientMessageId === message.clientMessageId)
      : undefined;
    if (optimistic) map.delete(optimistic[0]);
    const key = getMessageId(message);
    map.set(key, { ...map.get(key), ...message });
  }
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const canDeleteForEveryone = (message: Message, userId: string, now = Date.now()) =>
  message.senderId === userId && !message.deletedForEveryone && now - new Date(message.createdAt).getTime() <= 3600000;
