import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchJson } from '../lib/api';

export interface Status {
  _id: string; userId: string; mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; mediaMimeType: string;
  mediaSize: number; caption: string; expiresAt: string; createdAt: string; userName: string;
  userAvatarUrl: string | null; isMine: boolean;
}
interface State { statuses: Status[]; isLoading: boolean; isUploading: boolean; error: string | null; loadStatuses: () => Promise<void>; createStatus: (file: { uri: string; name: string; type: string }, caption?: string) => Promise<void>; deleteStatus: (id: string) => Promise<void>; }

export const useStatusStore = create<State>()(persist((set, get) => ({
  statuses: [], isLoading: false, isUploading: false, error: null,
  loadStatuses: async () => { set({ isLoading: true, error: null }); try { set({ statuses: await fetchJson<Status[]>('/statuses') }); } catch (error: any) { set({ error: error.message }); } finally { set({ isLoading: false }); } },
  createStatus: async (file, caption = '') => { set({ isUploading: true, error: null }); try { const form = new FormData(); form.append('file', file as any); form.append('caption', caption); form.append('audienceType', 'ALL_CONTACTS'); await fetchJson('/statuses', { method: 'POST', body: form }); await get().loadStatuses(); } finally { set({ isUploading: false }); } },
  deleteStatus: async (id) => { await fetchJson(`/statuses/${id}`, { method: 'DELETE' }); set((state) => ({ statuses: state.statuses.filter((item) => item._id !== id) })); },
}), { name: 'optichat-status-cache', storage: createJSONStorage(() => AsyncStorage), partialize: (state) => ({ statuses: state.statuses }) }));
