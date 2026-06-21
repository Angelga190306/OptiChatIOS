import { create } from 'zustand';
import { fetchApi } from '../lib/api';

export interface Participant {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  role: string;
}

export interface Chat {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  isGroup: boolean;
  isTyping: boolean;
  participants: Participant[];
  lastMessageSenderId: string | null;
  lastMessageStatus: string | null;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  
  setActiveChat: (chatId: string | null) => void;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<void>;
  createChat: (phoneNumber: string) => Promise<string>;
}

import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,
      messages: [],
      isLoadingChats: false,
      isLoadingMessages: false,

      setActiveChat: (chatId) => {
        set({ activeChatId: chatId, messages: [] });
        if (chatId) {
          get().loadMessages(chatId);
        }
      },

      loadChats: async () => {
        set({ isLoadingChats: true });
        try {
          const res = await fetchApi('/chats');
          const data = await res.json();
          set({ chats: data });
        } catch (error) {
          console.error("Failed to load chats", error);
        } finally {
          set({ isLoadingChats: false });
        }
      },

      loadMessages: async (chatId) => {
        set({ isLoadingMessages: true });
        try {
          const ts = new Date().getTime();
          const res = await fetchApi(`/chats/${chatId}/messages?t=${ts}`);
          const data = await res.json();
          set({ messages: data.messages || [] });
          
          try {
            await fetchApi(`/chats/${chatId}/read`, { method: 'POST', body: '{}' });
            get().loadChats();
          } catch (e) {
            // ignore
          }
        } catch (error) {
          console.error("Failed to load messages", error);
        } finally {
          set({ isLoadingMessages: false });
        }
      },

      sendMessage: async (chatId, content) => {
        try {
          const res = await fetchApi(`/chats/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
          });
          const newMsg = await res.json();
          
          if (get().activeChatId === chatId) {
            set((state) => ({ messages: [...state.messages, newMsg] }));
          }
          get().loadChats();
        } catch (error) {
          console.error("Failed to send message", error);
        }
      },

      createChat: async (phoneNumber) => {
        const res = await fetchApi('/chats', {
          method: 'POST',
          body: JSON.stringify({ participantPhone: phoneNumber })
        });
        const newChat = await res.json();
        await get().loadChats();
        return newChat.id;
      }
    }),
    {
      name: 'optichat-chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ chats: state.chats, messages: state.messages })
    }
  )
);
