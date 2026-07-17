import React, { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { chatLocalBytes, clearChatFiles, resolveMediaUrl } from '../lib/offlineFiles';
import { fetchJson } from '../lib/api';
import { Message } from '../types';

const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

// Referencia estable para evitar re-renders infinitos (mismo anti-patrón que ChatScreen).
const EMPTY: Message[] = [];

export default function ContactInfoScreen({ route }: any) {
  const { chatId, chatName, avatarUrl } = route.params;
  const user = useAuthStore((state) => state.user);
  const chat = useChatStore((state) => state.chats.find((item) => item.id === chatId));
  const messages = useChatStore((state) => state.messagesByChat?.[chatId] ?? EMPTY);
  const { loadMessages, clearLocalMedia } = useChatStore.getState();
  const startCall = useWebRTCStore((state) => state.startCall);
  const [localBytes, setLocalBytes] = useState(0);
  const [starred, setStarred] = useState<Message[]>([]);
  const target = Array.isArray(chat?.participants) ? chat?.participants.find((participant) => participant?.id !== user?.id) : undefined;
  const media = useMemo(() => messages.filter((message) => ['IMAGE', 'VIDEO'].includes(message.type) && !message.viewOnce && !message.deletedForEveryone), [messages]);
  const documents = useMemo(() => messages.filter((message) => ['DOCUMENT', 'AUDIO'].includes(message.type) && !message.deletedForEveryone), [messages]);
  const links = useMemo(() => messages.filter((message) => message.type === 'TEXT' && /https?:\/\/\S+/i.test(message.content)), [messages]);
  const knownBytes = messages.reduce((total, message) => total + Number(message.mediaSize || 0), 0);

  // Los mensajes destacados se obtienen del servidor (GET /chats/:id/starred) en
  // lugar de filtrarlos solo de la memoria, para incluir los que no están paginados.
  useEffect(() => {
    void loadMessages(chatId);
    void chatLocalBytes(chatId).then(setLocalBytes);
    void fetchJson<{ messages: Message[] }>(`/chats/${chatId}/starred`)
      .then((res) => setStarred(res.messages))
      .catch(() => undefined);
  }, [chatId]);
  const call = (video: boolean) => target && startCall(target.id, target.displayName || target.phoneNumber, video);
  const open = (message: Message) => {
    const uri = message.localUri || resolveMediaUrl(message.mediaUrl);
    if (uri) void Share.share({ url: uri, message: message.mediaName || message.content });
  };
  const clear = () => Alert.alert('Liberar copias offline', `Se eliminarán ${formatBytes(localBytes)} guardados en este teléfono. Los mensajes seguirán en el servidor.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Liberar', style: 'destructive', onPress: async () => { await clearChatFiles(chatId); clearLocalMedia(chatId); setLocalBytes(0); } },
  ]);

  const handleClearChat = () => {
    ActionSheetIOS.showActionSheetWithOptions({
      title: 'Vaciar Chat',
      options: ['Cancelar', 'Solo texto', 'Solo multimedia', 'Vaciar todo'],
      cancelButtonIndex: 0,
      destructiveButtonIndex: [1, 2, 3],
    }, async (index) => {
      if (index === 0) return;
      // El backend espera { clearMessages, clearMedia } (booleans), no { type }.
      const clearMessages = index === 1 || index === 3;
      const clearMedia = index === 2 || index === 3;
      try {
        await fetchJson(`/chats/${chatId}/clear`, {
          method: 'POST',
          body: JSON.stringify({ clearMessages, clearMedia })
        });
        if (clearMedia) {
          await clearChatFiles(chatId);
          clearLocalMedia(chatId);
          setLocalBytes(0);
        }
        void loadMessages(chatId);
        Alert.alert('Éxito', 'El chat ha sido vaciado correctamente.');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    });
  };

  const avatar = resolveMediaUrl(avatarUrl || chat?.avatarUrl);
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.fallback}><Text style={styles.initial}>{chatName?.[0] || '?'}</Text></View>}<Text style={styles.name}>{chatName}</Text><Text style={styles.phone}>{target?.phoneNumber || ''}</Text><Text style={styles.presence}>{target?.isOnline ? 'en línea' : target?.lastSeen ? `Última vez ${new Date(target.lastSeen).toLocaleString()}` : ''}</Text>
        <View style={styles.actions}><Action icon="call" label="Llamar" onPress={() => call(false)} /><Action icon="videocam" label="Video" onPress={() => call(true)} /></View>
      </View>
      <Section title="Archivos, enlaces y documentos" subtitle={`${media.length} multimedia · ${documents.length} archivos · ${links.length} enlaces`} />
      {media.length > 0 && <View style={styles.grid}>{media.slice(-12).map((message) => <TouchableOpacity key={message._id} onPress={() => open(message)}>{message.type === 'IMAGE' ? <Image source={{ uri: message.localUri || resolveMediaUrl(message.mediaUrl)! }} style={styles.thumb} /> : <View style={[styles.thumb, styles.videoThumb]}><Icon name="play-circle" size={32} color="#fff" /></View>}</TouchableOpacity>)}</View>}
      <View style={styles.section}><Text style={styles.sectionTitle}>Mensajes destacados</Text><Text style={styles.subtitle}>{starred.length} mensajes</Text>{starred.slice(0, 10).map((message) => <Text key={message._id} numberOfLines={2} style={styles.starred}>★ {message.content}</Text>)}</View>
      <TouchableOpacity style={styles.section} onPress={clear}><Text style={styles.sectionTitle}>Administrar almacenamiento</Text><Text style={styles.subtitle}>{formatBytes(localBytes)} guardados offline · {formatBytes(knownBytes)} de contenido conocido</Text><Text style={styles.link}>Liberar copias offline</Text></TouchableOpacity>
      <TouchableOpacity style={styles.section} onPress={handleClearChat}><Text style={[styles.sectionTitle, { color: '#d32f2f' }]}>Vaciar chat</Text><Text style={styles.subtitle}>Eliminar mensajes de tu dispositivo de forma permanente</Text></TouchableOpacity>
    </ScrollView>
  );
}

function Action({ icon, label, onPress }: any) { return <TouchableOpacity style={styles.action} onPress={onPress}><Icon name={icon} size={27} color="#0066cc" /><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
function Section({ title, subtitle }: any) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f2f4' }, header: { alignItems: 'center', padding: 24, backgroundColor: '#fff' }, avatar: { width: 120, height: 120, borderRadius: 60 }, fallback: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#8ba4b8', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontSize: 46, fontWeight: '700' }, name: { marginTop: 14, fontSize: 25, fontWeight: '700', color: '#111' }, phone: { marginTop: 4, color: '#555' }, presence: { marginTop: 3, color: '#228b45', fontSize: 13 }, actions: { flexDirection: 'row', gap: 55, marginTop: 20 }, action: { alignItems: 'center' }, actionText: { color: '#0066cc', marginTop: 5, fontWeight: '600' },
  section: { marginTop: 13, padding: 16, backgroundColor: '#fff' }, sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111' }, subtitle: { color: '#666', marginTop: 4 }, link: { color: '#0066cc', marginTop: 12, fontWeight: '600' },
  grid: { padding: 8, backgroundColor: '#fff', flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, thumb: { width: 83, height: 83, borderRadius: 4 }, videoThumb: { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }, starred: { paddingVertical: 8, color: '#333', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
});
