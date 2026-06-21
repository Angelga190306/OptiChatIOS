import { create } from 'zustand';
import { fetchApi } from '../lib/api';

export interface Status {
  _id: string;
  userId: string;
  mediaUrl: string;
  mediaObjectName: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaMimeType: string;
  mediaSize: number;
  caption: string;
  audienceType: string;
  audienceUserIds: string[];
  expiresAt: string;
  createdAt: string;
  userName: string;
  userAvatarUrl: string | null;
  isMine: boolean;
}

interface StatusState {
  statuses: Status[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  loadStatuses: () => Promise<void>;
  createStatus: (file: File, caption?: string) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  statuses: [],
  isLoading: false,
  isUploading: false,
  error: null,

  loadStatuses: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetchApi('/statuses');
      if (!res.ok) throw new Error("Error al obtener los estados");
      const data = await res.json();
      set({ statuses: data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createStatus: async (file, caption = '') => {
    set({ isUploading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', caption);
      formData.append('audienceType', 'ALL_CONTACTS');

      const res = await fetchApi('/statuses', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al subir el estado");
      }

      await get().loadStatuses();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ isUploading: false });
    }
  },

  deleteStatus: async (id) => {
    set({ error: null });
    try {
      const res = await fetchApi(`/statuses/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error("Error al eliminar el estado");
      
      set((state) => ({
        statuses: state.statuses.filter((s) => s._id !== id),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));
