import RNFS from 'react-native-fs';
import { getApiUrl } from './api';
import { useAuthStore } from '../store/useAuthStore';
import { Message } from '../types';

const ROOT = `${RNFS.DocumentDirectoryPath}/optichat-offline`;
const PROFILE_DIR = `${ROOT}/profile`;
const CHAT_DIR = `${ROOT}/chats`;

const ensureDir = async (path: string) => {
  if (!await RNFS.exists(path)) await RNFS.mkdir(path);
};

export const resolveMediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('file://')) return url;
  if (url.startsWith('/api/')) return `https://optichat.optishieldx.com${url}`;
  if (url.startsWith('/')) return getApiUrl(url);
  return url.replace(/^http:\/\/[^/]+/, 'https://optichat.optishieldx.com');
};

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);

export async function cacheOwnAvatar(remoteUrl?: string | null, sourceUri?: string | null) {
  await ensureDir(ROOT);
  await ensureDir(PROFILE_DIR);
  const destination = `${PROFILE_DIR}/my-avatar.jpg`;
  const temporary = `${destination}.tmp`;
  try {
    if (await RNFS.exists(temporary)) await RNFS.unlink(temporary);
    if (sourceUri) {
      await RNFS.copyFile(sourceUri.replace('file://', ''), temporary);
    } else if (remoteUrl) {
      const token = useAuthStore.getState().accessToken;
      const result = RNFS.downloadFile({
        fromUrl: resolveMediaUrl(remoteUrl)!,
        toFile: temporary,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const response = await result.promise;
      if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP ${response.statusCode}`);
    } else {
      return null;
    }
    if (await RNFS.exists(destination)) await RNFS.unlink(destination);
    await RNFS.moveFile(temporary, destination);
    return `file://${destination}`;
  } catch {
    if (await RNFS.exists(temporary)) await RNFS.unlink(temporary).catch(() => undefined);
    return await RNFS.exists(destination) ? `file://${destination}` : null;
  }
}

export async function cacheMessageFile(message: Message): Promise<string | null> {
  if (!message.mediaUrl || message.viewOnce) return message.localUri || null;
  const directory = `${CHAT_DIR}/${safeName(message.conversationId)}`;
  await ensureDir(ROOT);
  await ensureDir(CHAT_DIR);
  await ensureDir(directory);
  const extension = message.mediaName?.split('.').pop() || message.mediaMimeType?.split('/').pop() || 'bin';
  const destination = `${directory}/${safeName(message._id)}.${safeName(extension)}`;
  if (await RNFS.exists(destination)) return `file://${destination}`;
  const temporary = `${destination}.tmp`;
  try {
    const token = useAuthStore.getState().accessToken;
    const response = await RNFS.downloadFile({
      fromUrl: resolveMediaUrl(message.mediaUrl)!,
      toFile: temporary,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).promise;
    if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP ${response.statusCode}`);
    await RNFS.moveFile(temporary, destination);
    return `file://${destination}`;
  } catch {
    if (await RNFS.exists(temporary)) await RNFS.unlink(temporary).catch(() => undefined);
    return null;
  }
}

export async function chatLocalBytes(chatId: string) {
  const directory = `${CHAT_DIR}/${safeName(chatId)}`;
  if (!await RNFS.exists(directory)) return 0;
  const files = await RNFS.readDir(directory);
  return files.reduce((total, item) => total + (item.isFile() ? Number(item.size) : 0), 0);
}

export async function clearChatFiles(chatId: string) {
  const directory = `${CHAT_DIR}/${safeName(chatId)}`;
  if (await RNFS.exists(directory)) await RNFS.unlink(directory);
}

export async function copyToOffline(uri: string, chatId: string, fileName: string) {
  const directory = `${CHAT_DIR}/${safeName(chatId)}`;
  await ensureDir(ROOT);
  await ensureDir(CHAT_DIR);
  await ensureDir(directory);
  const destination = `${directory}/out-${Date.now()}-${safeName(fileName)}`;
  await RNFS.copyFile(uri.replace('file://', ''), destination);
  return `file://${destination}`;
}
