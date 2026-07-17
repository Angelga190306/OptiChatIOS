import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'optichat-device-id';

let cachedDeviceId: string | null = null;

/** Genera un UUID v4 (RFC 4122) sin dependencias externas. */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Devuelve un `deviceId` estable por dispositivo, generándolo y persistiéndolo
 * en AsyncStorage en el primer arranque. El backend lo usa para validar el
 * dispositivo (server/src/lib/socket.ts y routes/auth.ts).
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  const id = uuidv4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  cachedDeviceId = id;
  return id;
}

/** Modelo legible del dispositivo para enviarlo al backend. */
export function getDeviceModel(): string {
  return (Platform.constants as any)?.Model || (Platform as any).modelName || Platform.OS || 'iOS';
}