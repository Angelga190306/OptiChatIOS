import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { useChatStore } from '../store/useChatStore';
import { useStatusStore } from '../store/useStatusStore';

const ROOT = `${RNFS.DocumentDirectoryPath}/optichat-offline`;

/**
 * Borra toda la caché local del usuario (mensajes, chats, estados, archivos
 * multimedia offline y avatares). Se invoca al cerrar sesión para que el siguiente
 * usuario no vea datos del anterior (paridad con Android AuthRepository.logout).
 */
export async function clearLocalCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem('optichat-chat-storage-v2');
    await AsyncStorage.removeItem('optichat-status-cache');
    if (await RNFS.exists(ROOT)) await RNFS.unlink(ROOT).catch(() => undefined);
    useChatStore.setState({
      chats: [],
      messagesByChat: {},
      outbox: [],
      activeChatId: null,
      isOnline: true,
    });
    useStatusStore.setState({ statuses: [] });
  } catch (error) {
    console.warn('Error limpiando caché local', error);
  }
}