import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';
import { cacheMessageFile } from '../lib/offlineFiles';
import { fetchJson } from '../lib/api';
import { getDeviceId, getDeviceModel } from '../lib/device';
import { Message } from '../types';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  lastError: string | null;
  activeToken: string | null;
  connect: (force?: boolean) => void;
  disconnect: () => void;
  reconnectForNetwork: () => void;
  reportScreenshot: (conversationId: string, messageId?: string) => Promise<void>;
}

const bindChatEvents = (socket: Socket) => {
  socket.on('new_message', (message: Message) => {
    useChatStore.getState().upsertMessage(message);
    void useChatStore.getState().loadChats();
    if (message.mediaUrl && !message.viewOnce) {
      void cacheMessageFile(message).then((localUri) => {
        if (localUri) useChatStore.getState().upsertMessage({ ...message, localUri });
      });
    }
  });
  socket.on('messages_read', ({ conversationId }: any) => useChatStore.getState().updateMessageStatus(conversationId, 'read'));
  socket.on('messages_delivered', ({ conversationId }: any) => useChatStore.getState().updateMessageStatus(conversationId, 'delivered'));
  socket.on('message_deleted', (event: any) => useChatStore.getState().applyDeletedMessage(event));
  socket.on('message_starred', ({ conversationId, messageId, starred }: any) =>
    useChatStore.getState().updateStarred(conversationId, messageId, starred));
  socket.on('presence_changed', ({ userId, isOnline, lastSeen }: any) =>
    useChatStore.getState().setPresence(userId, Boolean(isOnline), lastSeen));
  socket.on('typing_changed', ({ conversationId, isTyping }: any) =>
    useChatStore.getState().setTyping(conversationId, Boolean(isTyping)));
  socket.on('block_status_changed', ({ targetUserId, blockedByMe }: any) =>
    useChatStore.getState().updateBlockStatus(targetUserId, Boolean(blockedByMe)));
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  lastError: null,
  activeToken: null,

  connect: (force = false) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const current = get().socket;
    if (!force && current && get().activeToken === token) {
      if (!current.connected) current.connect();
      return;
    }
    current?.removeAllListeners();
    current?.disconnect();

    // Se construye el socket de forma asíncrona para poder adjuntar el deviceId
    // (AsyncStorage es async). El backend desconecta sockets sin deviceId válido.
    void (async () => {
      const deviceId = await getDeviceId();
      const socket = io('https://optichat.optishieldx.com', {
        path: '/socket.io',
        auth: {
          token,
          deviceId,
          deviceModel: getDeviceModel(),
          deviceLocation: '0.0,0.0',
        },
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        timeout: 15000,
      });
      bindChatEvents(socket);
      socket.on('connect', () => {
        set({ connected: true, lastError: null });
        useChatStore.getState().setOnline(true);
        void useChatStore.getState().flushOutbox();
        void useChatStore.getState().loadChats();
        // Marca la conversación activa como entregada al reconectar (receipt).
        const activeChatId = useChatStore.getState().activeChatId;
        if (activeChatId) void useChatStore.getState().markDelivered(activeChatId);
      });
      socket.on('disconnect', () => set({ connected: false }));
      socket.on('connect_error', (error) => set({ connected: false, lastError: error.message }));
      set({ socket, activeToken: token, connected: false });
      socket.connect();
    })();
  },

  reconnectForNetwork: () => {
    useChatStore.getState().setOnline(true);
    get().connect(true);
  },

  disconnect: () => {
    const socket = get().socket;
    socket?.removeAllListeners();
    socket?.disconnect();
    set({ socket: null, activeToken: null, connected: false });
  },

  reportScreenshot: async (conversationId, messageId) => {
    if (!messageId) return;
    // El backend no expone un evento Socket.IO para reportar capturas; usa REST.
    try {
      await fetchJson(`/chats/${conversationId}/messages/${messageId}/view-once/screenshot-attempt`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.warn('No se pudo reportar la captura de pantalla al remitente', error);
    }
  },

}));
