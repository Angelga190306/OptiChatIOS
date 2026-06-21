import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchJson } from '../lib/api';
import { cacheMessageFile, copyToOffline } from '../lib/offlineFiles';
import { useAuthStore } from './useAuthStore';
import { Chat, Message, PendingMessage } from '../types';
import { createClientId, getMessageId, mergeMessageLists } from '../lib/messageUtils';

interface ChatState {
  chats: Chat[];
  messagesByChat: Record<string, Message[]>;
  activeChatId: string | null;
  outbox: PendingMessage[];
  isOnline: boolean;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  setOnline: (online: boolean) => void;
  setActiveChat: (chatId: string | null) => void;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<void>;
  sendMedia: (chatId: string, uri: string, fileName: string, mimeType: string, options?: { durationMs?: number; viewOnce?: boolean }) => Promise<void>;
  flushOutbox: () => Promise<void>;
  createChat: (phoneNumber: string) => Promise<string>;
  upsertMessage: (message: Message) => void;
  updateMessageStatus: (conversationId: string, status: 'delivered' | 'read') => void;
  applyDeletedMessage: (event: any) => void;
  updateStarred: (conversationId: string, id: string, starred: boolean) => void;
  toggleStarred: (message: Message) => Promise<void>;
  deleteMessage: (message: Message, scope: 'me' | 'everyone') => Promise<void>;
  forwardMessage: (message: Message, targetChatId: string) => Promise<void>;
  setPresence: (userId: string, isOnline: boolean, lastSeen?: string | null) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  clearLocalMedia: (conversationId: string) => void;
}

async function uploadPending(item: PendingMessage): Promise<Message> {
  if (item.kind === 'text') {
    return fetchJson<Message>(`/chats/${item.conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: item.content, type: 'TEXT', clientMessageId: item.clientMessageId }),
    });
  }
  const form = new FormData();
  form.append('clientMessageId', item.clientMessageId);
  if (item.durationMs != null) form.append('durationMs', String(item.durationMs));
  if (item.viewOnce) form.append('viewOnce', 'true');
  form.append('file', { uri: item.localUri, name: item.fileName, type: item.mimeType } as any);
  return fetchJson<Message>(`/chats/${item.conversationId}/media`, { method: 'POST', body: form });
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      messagesByChat: {},
      activeChatId: null,
      outbox: [],
      isOnline: true,
      isLoadingChats: false,
      isLoadingMessages: false,

      setOnline: (isOnline) => set({ isOnline }),
      setActiveChat: (activeChatId) => set({ activeChatId }),

      loadChats: async () => {
        if (!get().isOnline) return;
        set({ isLoadingChats: true });
        try {
          const chats = await fetchJson<Chat[]>('/chats');
          set({ chats });
        } catch (error) {
          console.warn('No se pudieron actualizar los chats; se conserva la caché', error);
        } finally {
          set({ isLoadingChats: false });
        }
      },

      loadMessages: async (chatId) => {
        set({ activeChatId: chatId });
        if (!get().isOnline) return;
        set({ isLoadingMessages: true });
        try {
          let page = 1;
          let totalPages = 1;
          const all: Message[] = [];
          do {
            const response = await fetchJson<{ messages: Message[]; totalPages: number }>(`/chats/${chatId}/messages?page=${page}`);
            all.push(...response.messages);
            totalPages = response.totalPages || 1;
            page += 1;
          } while (page <= totalPages);
          set((state) => ({ messagesByChat: { ...state.messagesByChat, [chatId]: mergeMessageLists([], all) } }));
          void Promise.all(all.filter((message) => message.mediaUrl && !message.viewOnce).map(async (message) => {
            const localUri = await cacheMessageFile(message);
            if (localUri) get().upsertMessage({ ...message, localUri });
          }));
          await fetchJson(`/chats/${chatId}/read`, { method: 'POST', body: '{}' }).catch(() => undefined);
          void get().loadChats();
        } catch (error) {
          console.warn('No se pudieron actualizar los mensajes; se conserva la caché', error);
        } finally {
          set({ isLoadingMessages: false });
        }
      },

      sendMessage: async (conversationId, content) => {
        const user = useAuthStore.getState().user;
        if (!user || !content.trim()) return;
        const pending: PendingMessage = { clientMessageId: createClientId(), conversationId, kind: 'text', content: content.trim(), createdAt: new Date().toISOString() };
        get().upsertMessage({
          _id: `pending-${pending.clientMessageId}`,
          clientMessageId: pending.clientMessageId,
          conversationId,
          senderId: user.id,
          senderName: user.displayName || user.phoneNumber,
          content: pending.content!, type: 'TEXT', status: 'pending', createdAt: pending.createdAt,
        });
        set((state) => ({ outbox: [...state.outbox, pending] }));
        if (get().isOnline) await get().flushOutbox();
      },

      sendMedia: async (conversationId, uri, fileName, mimeType, options = {}) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        const localUri = await copyToOffline(uri, conversationId, fileName);
        const pending: PendingMessage = {
          clientMessageId: createClientId(), conversationId, kind: 'media', localUri, fileName, mimeType,
          durationMs: options.durationMs, viewOnce: options.viewOnce, createdAt: new Date().toISOString(),
        };
        const type = mimeType.startsWith('image/') ? 'IMAGE' : mimeType.startsWith('video/') ? 'VIDEO' : mimeType.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT';
        get().upsertMessage({
          _id: `pending-${pending.clientMessageId}`, clientMessageId: pending.clientMessageId,
          conversationId, senderId: user.id, senderName: user.displayName || user.phoneNumber,
          content: type === 'IMAGE' ? '📷 Foto' : type === 'VIDEO' ? '🎥 Video' : type === 'AUDIO' ? 'Nota de voz' : `📄 ${fileName}`,
          type, status: 'pending', localUri, mediaName: fileName, mediaMimeType: mimeType,
          mediaDuration: options.durationMs, viewOnce: options.viewOnce, createdAt: pending.createdAt,
        });
        set((state) => ({ outbox: [...state.outbox, pending] }));
        if (get().isOnline) await get().flushOutbox();
      },

      flushOutbox: async () => {
        if (!get().isOnline || !useAuthStore.getState().accessToken) return;
        for (const item of [...get().outbox]) {
          try {
            const delivered = await uploadPending(item);
            if (item.localUri && !delivered.viewOnce) delivered.localUri = item.localUri;
            get().upsertMessage(delivered);
            set((state) => ({ outbox: state.outbox.filter((entry) => entry.clientMessageId !== item.clientMessageId) }));
          } catch (error) {
            console.warn('Mensaje conservado en espera', error);
            break;
          }
        }
        void get().loadChats();
      },

      createChat: async (phoneNumber) => {
        const chat = await fetchJson<Chat>('/chats', { method: 'POST', body: JSON.stringify({ participantPhone: phoneNumber }) });
        await get().loadChats();
        return chat.id;
      },

      upsertMessage: (message) => set((state) => ({
        messagesByChat: {
          ...state.messagesByChat,
          [message.conversationId]: mergeMessageLists(state.messagesByChat[message.conversationId] || [], [message]),
        },
      })),

      updateMessageStatus: (conversationId, status) => set((state) => ({
        messagesByChat: {
          ...state.messagesByChat,
          [conversationId]: (state.messagesByChat[conversationId] || []).map((message) =>
            message.senderId === useAuthStore.getState().user?.id ? { ...message, status } : message),
        },
      })),

      applyDeletedMessage: (event) => set((state) => {
        const current = state.messagesByChat[event.conversationId] || [];
        return { messagesByChat: { ...state.messagesByChat, [event.conversationId]: event.mode === 'me'
          ? current.filter((message) => getMessageId(message) !== event.messageId)
          : current.map((message) => getMessageId(message) === event.messageId ? { ...message, ...event.message, deletedForEveryone: true } : message) } };
      }),

      updateStarred: (conversationId, id, isStarred) => set((state) => ({ messagesByChat: {
        ...state.messagesByChat,
        [conversationId]: (state.messagesByChat[conversationId] || []).map((message) => getMessageId(message) === id ? { ...message, isStarred } : message),
      } })),

      toggleStarred: async (message) => {
        const id = getMessageId(message);
        const starred = !message.isStarred;
        get().updateStarred(message.conversationId, id, starred);
        try {
          await fetchJson(`/chats/${message.conversationId}/messages/${id}/star`, { method: 'PUT', body: JSON.stringify({ starred }) });
        } catch (error) {
          get().updateStarred(message.conversationId, id, !starred);
          throw error;
        }
      },

      deleteMessage: async (message, scope) => {
        const id = getMessageId(message);
        const response = await fetchJson<any>(`/chats/${message.conversationId}/messages/${id}?scope=${scope}`, { method: 'DELETE' });
        get().applyDeletedMessage({ conversationId: message.conversationId, messageId: id, ...response });
      },

      forwardMessage: async (message, targetChatId) => {
        const forwarded = await fetchJson<Message>(`/chats/${targetChatId}/messages/${getMessageId(message)}/forward`, { method: 'POST', body: '{}' });
        get().upsertMessage(forwarded);
      },

      setPresence: (userId, isOnline, lastSeen = null) => set((state) => ({ chats: state.chats.map((chat) => ({
        ...chat, participants: chat.participants.map((participant) => participant.id === userId ? { ...participant, isOnline, lastSeen } : participant),
      })) })),

      setTyping: (conversationId, isTyping) => set((state) => ({ chats: state.chats.map((chat) => chat.id === conversationId ? { ...chat, isTyping } : chat) })),
      clearLocalMedia: (conversationId) => set((state) => ({ messagesByChat: {
        ...state.messagesByChat,
        [conversationId]: (state.messagesByChat[conversationId] || []).map((message) => ({ ...message, localUri: null })),
      } })),
    }),
    {
      name: 'optichat-chat-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      partialize: (state) => ({ chats: state.chats, messagesByChat: state.messagesByChat, outbox: state.outbox }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        chats: Array.isArray(persisted?.chats) ? persisted.chats : [],
        messagesByChat: persisted?.messagesByChat && typeof persisted.messagesByChat === 'object' ? persisted.messagesByChat : {},
        outbox: Array.isArray(persisted?.outbox) ? persisted.outbox : [],
      }),
    },
  ),
);
