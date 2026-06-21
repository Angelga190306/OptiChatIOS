import { canDeleteForEveryone, createClientId, mergeMessageLists } from '../src/lib/messageUtils';
import { Message } from '../src/types';

const message = (overrides: Partial<Message> = {}): Message => ({
  _id: 'server-1', conversationId: 'chat-1', senderId: 'me', senderName: 'Yo', content: 'hola',
  type: 'TEXT', status: 'sent', createdAt: '2026-06-20T12:00:00.000Z', ...overrides,
});

test('reemplaza el mensaje optimista por la copia confirmada sin duplicarlo', () => {
  const pending = message({ _id: 'pending-client-1', clientMessageId: 'client-1', status: 'pending' });
  const confirmed = message({ _id: 'server-9', clientMessageId: 'client-1', status: 'delivered' });
  expect(mergeMessageLists([pending], [confirmed])).toEqual([confirmed]);
});

test('solo permite eliminar para todos mensajes propios durante una hora', () => {
  const now = new Date('2026-06-20T12:59:59.000Z').getTime();
  expect(canDeleteForEveryone(message(), 'me', now)).toBe(true);
  expect(canDeleteForEveryone(message(), 'otro', now)).toBe(false);
  expect(canDeleteForEveryone(message(), 'me', now + 2000)).toBe(false);
});

test('genera identificadores de cliente estables para la outbox', () => {
  expect(createClientId(() => 123, () => 0.5)).toBe('123-i-i');
});
