import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './useAuthStore';
import { useChatStore } from './useChatStore';

interface SocketState {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connect: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    if (get().socket) return; // already connected

    // Conectar directamente al backend de producción
    const socket = io('https://optichat.optishieldx.com', {
      path: '/socket.io',
      query: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('🔌 Conectado a WebSocket', socket.id);
    });

    socket.on('new_message', (msg) => {
      console.log('📩 Nuevo mensaje por WS', msg);
      // Recargar chats para actualizar último mensaje
      useChatStore.getState().loadChats();

      // Si tenemos este chat abierto, agregarlo
      const { activeChatId, messages, loadMessages } = useChatStore.getState();
      if (activeChatId === msg.conversationId) {
        // Podríamos agregarlo a la lista directamente, pero es más seguro recargar la página para manejar paginación y read status
        loadMessages(activeChatId!);
      }
    });

    socket.on('messages_read', (data: { conversationId: string }) => {
      console.log('👀 Mensajes leídos por WS', data);
      const { activeChatId, loadMessages } = useChatStore.getState();
      if (activeChatId === data.conversationId) {
        // Recargar mensajes para mostrar palomitas azules
        loadMessages(activeChatId!);
      }
    });

    socket.on('messages_delivered', (data: { conversationId: string }) => {
      console.log('📬 Mensajes entregados por WS', data);
      const { activeChatId, loadMessages } = useChatStore.getState();
      if (activeChatId === data.conversationId) {
        // Recargar mensajes para mostrar palomitas grises dobles
        loadMessages(activeChatId!);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Desconectado de WebSocket');
    });

    set({ socket });
  },
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  }
}));
