import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchJson } from '../lib/api';
import { useChatStore } from './useChatStore';
import { Message } from '../types';

export interface StatusViewer {
  userId: string;
  displayName: string;
  phoneNumber: string;
  avatarUrl: string | null;
  viewedAt: string;
}

export type StatusAudienceType = 'ALL_CONTACTS' | 'CONTACTS_EXCEPT' | 'ONLY_SHARE_WITH';

export interface Status {
  _id: string; userId: string; mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; mediaMimeType: string;
  mediaSize: number; caption: string; expiresAt: string; createdAt: string; userName: string;
  userAvatarUrl: string | null; isMine: boolean;
  hasViewed?: boolean;
  viewCount?: number;
  viewers?: StatusViewer[];
  audienceType?: StatusAudienceType;
  audienceUserIds?: string[];
}

interface State {
  statuses: Status[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  loadStatuses: () => Promise<void>;
  createStatus: (file: { uri: string; name: string; type: string }, caption?: string, audience?: { type: StatusAudienceType; userIds?: string[] }) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;
  viewStatus: (id: string) => Promise<void>;
  replyToStatus: (id: string, content: string) => Promise<void>;
}

export const useStatusStore = create<State>()(persist((set, get) => ({
  statuses: [], isLoading: false, isUploading: false, error: null,

  loadStatuses: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ statuses: await fetchJson<Status[]>('/statuses') });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createStatus: async (file, caption = '', audience) => {
    set({ isUploading: true, error: null });
    try {
      const form = new FormData();
      form.append('caption', caption);
      form.append('audienceType', audience?.type || 'ALL_CONTACTS');
      if (audience?.userIds && audience.userIds.length > 0) {
        form.append('audienceUserIds', JSON.stringify(audience.userIds));
      }
      form.append('file', file as any);
      await fetchJson('/statuses', { method: 'POST', body: form });
      await get().loadStatuses();
    } finally {
      set({ isUploading: false });
    }
  },

  deleteStatus: async (id) => {
    await fetchJson(`/statuses/${id}`, { method: 'DELETE' });
    set((state) => ({ statuses: state.statuses.filter((item) => item._id !== id) }));
  },

  // Registra la vista de un estado ajeno (receipt). Marca hasViewed localmente.
  viewStatus: async (id) => {
    try {
      await fetchJson(`/statuses/${id}/view`, { method: 'POST', body: '{}' });
      set((state) => ({
        statuses: state.statuses.map((item) => (item._id === id ? { ...item, hasViewed: true } : item)),
      }));
    } catch (error) {
      console.warn('No se pudo registrar la vista del estado', error);
    }
  },

  // Responde a un estado ajeno: el backend crea/usa la conversación 1:1 con el
  // dueño del estado y devuelve el mensaje creado, que insertamos en el chat.
  replyToStatus: async (id, content) => {
    const result = await fetchJson<{ conversationId: string; message: Message }>(`/statuses/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    useChatStore.getState().upsertMessage(result.message);
    void useChatStore.getState().loadChats();
  },
}), {
  name: 'optichat-status-cache',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({ statuses: state.statuses }),
}));