import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocketStore } from "./useSocketStore";

export interface User {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  about: string | null;
  avatarUrl: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      login: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        useSocketStore.getState().connect();
      },
      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        useSocketStore.getState().disconnect();
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'optichat-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
