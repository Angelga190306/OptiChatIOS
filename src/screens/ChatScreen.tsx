import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal,
  Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { CameraRoll, iosRequestAddOnlyGalleryPermission } from '@react-native-camera-roll/camera-roll';
import { pick, types } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import { getApiUrl } from '../lib/api';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useSocketStore } from '../store/useSocketStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Message } from '../types';

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;
const idOf = (message: Message) => message._id || message.id || '';

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation<any>();
  const { chatId, chatName, avatarUrl } = route.params;
  const chats = useChatStore((state) => state.chats);
  const messages = useChatStore((state) => state.messagesByChat?.[chatId] || []);
  const isLoading = useChatStore((state) => state.isLoadingMessages);
  const { loadMessages, sendMessage, sendMedia, toggleStarred, deleteMessage, forwardMessage } = useChatStore.getState();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const startCall = useWebRTCStore((state) => state.startCall);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [viewer, setViewer] = useState<{ message: Message; uri: string; once: boolean } | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = chats.find((item) => item.id === chatId);
  const target = Array.isArray(chat?.participants) ? chat?.participants.find((participant) => participant?.id !== user?.id) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: chatName,
      headerTitle: () => (
        <TouchableOpacity onPress={() => navigation.navigate('ContactInfo', { chatId, chatName, avatarUrl: avatarUrl || chat?.avatarUrl })}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{chatName}</Text>
          <Text style={{ color: '#d8e8ff', fontSize: 11 }}>
            {chat?.isTyping ? 'escribiendo…' : target?.isOnline ? 'en línea' : target?.lastSeen ? `últ. vez ${new Date(target.lastSeen).toLocaleString()}` : ''}
          </Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <TouchableOpacity onPress={() => target && startCall(target.id, target.displayName || target.phoneNumber, false)}><Icon name="call" size={24} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={() => target && startCall(target.id, target.displayName || target.phoneNumber, true)}><Icon name="videocam" size={25} color="#fff" /></TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, chat, target, chatName, avatarUrl]);

  useEffect(() => {
    void loadMessages(chatId);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      useSocketStore.getState().socket?.emit('typing_stop', { conversationId: chatId });
    };
  }, [chatId]);

  const onTextChange = (value: string) => {
    setText(value);
    const socket = useSocketStore.getState().socket;
    socket?.emit(value ? 'typing_start' : 'typing_stop', { conversationId: chatId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit('typing_stop', { conversationId: chatId }), 1600);
  };

  const choosePhotoOrVideo = async () => {
    const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.9 });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const mime = asset.type || (asset.uri.toLowerCase().includes('.mov') ? 'video/quicktime' : 'image/jpeg');
    const send = (viewOnce: boolean) => void sendMedia(chatId, asset.uri!, asset.fileName || `media-${Date.now()}`, mime, { viewOnce });
    Alert.alert('Enviar multimedia', '¿Cómo quieres enviarla?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Normal', onPress: () => send(false) },
      { text: 'Ver una vez', onPress: () => send(true) },
    ]);
  };

  const chooseDocument = async () => {
    try {
      const selected = await pick({ type: [types.allFiles], allowMultiSelection: false });
      const file = selected[0];
      if (file?.uri) await sendMedia(chatId, file.uri, file.name || `archivo-${Date.now()}`, file.type || 'application/octet-stream');
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('cancel')) Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const openAttachmentMenu = () => ActionSheetIOS.showActionSheetWithOptions({
    options: ['Cancelar', 'Foto o video', 'Documento'], cancelButtonIndex: 0,
  }, (index) => { if (index === 1) void choosePhotoOrVideo(); if (index === 2) void chooseDocument(); });

  const openViewOnce = async (message: Message) => {
    if (message.senderId === user?.id || message.viewOnceOpened) return;
    Alert.alert('Visualización única', 'Solo podrás verlo una vez. Si intentas capturar la pantalla, se notificará al remitente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Abrir', onPress: async () => {
        try {
          const result = await ReactNativeBlobUtil.config({ fileCache: true, appendExt: message.type === 'VIDEO' ? 'mp4' : 'jpg' }).fetch(
            'POST', getApiUrl(`/chats/${chatId}/messages/${idOf(message)}/view-once/open`),
            { Authorization: `Bearer ${accessToken}` },
          );
          setViewer({ message, uri: `file://${result.path()}`, once: true });
          useChatStore.getState().upsertMessage({ ...message, viewOnceOpened: true });
        } catch { Alert.alert('No disponible', 'Este contenido ya fue abierto o expiró.'); }
      } },
    ]);
  };

  const openMessage = (message: Message) => {
    if (message.viewOnce) return void openViewOnce(message);
    const uri = message.localUri || resolveMediaUrl(message.mediaUrl);
    if (!uri) return;
    if (message.type === 'IMAGE' || message.type === 'VIDEO') setViewer({ message, uri, once: false });
    else void Share.share({ url: uri, message: message.mediaName || message.content });
  };

  const saveViewer = async () => {
    if (!viewer || viewer.once) return;
    const permission = await iosRequestAddOnlyGalleryPermission();
    if (!['granted', 'limited'].includes(permission)) return Alert.alert('Permiso requerido', 'Activa Fotos en Ajustes para guardar el archivo.');
    await CameraRoll.save(viewer.uri, { type: viewer.message.type === 'VIDEO' ? 'video' : 'photo', album: 'OptiChat' });
    Alert.alert('Guardado', 'El archivo se guardó en Fotos.');
  };

  const showMessageActions = (message: Message) => {
    if (message.status === 'pending' || message.viewOnce) return;
    const own = message.senderId === user?.id;
    const withinHour = Date.now() - new Date(message.createdAt).getTime() <= 3600000;
    const labels = ['Cancelar'];
    const actions: Array<() => void> = [() => undefined];
    if (message.type === 'TEXT' && !message.deletedForEveryone) { labels.push('Copiar'); actions.push(() => Clipboard.setString(message.content)); }
    labels.push(message.isStarred ? 'Quitar destacado' : 'Destacar'); actions.push(() => void toggleStarred(message));
    labels.push('Reenviar'); actions.push(() => setForwarding(message));
    labels.push('Eliminar para mí'); actions.push(() => void deleteMessage(message, 'me').catch((e) => Alert.alert('Error', e.message)));
    if (own && withinHour && !message.deletedForEveryone) { labels.push('Eliminar para todos'); actions.push(() => void deleteMessage(message, 'everyone').catch((e) => Alert.alert('Error', e.message))); }
    ActionSheetIOS.showActionSheetWithOptions({ options: labels, cancelButtonIndex: 0, destructiveButtonIndex: labels.map((x, i) => x.startsWith('Eliminar') ? i : -1).filter((i) => i >= 0) }, (index) => actions[index]?.());
  };

  const statusIcon = (message: Message) => message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : message.status === 'pending' ? '◷' : message.status === 'failed' ? '!' : '✓';

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.senderId === user?.id;
    const mediaUri = item.localUri || resolveMediaUrl(item.mediaUrl);
    return (
      <TouchableOpacity activeOpacity={0.8} onLongPress={() => showMessageActions(item)} onPress={() => item.type !== 'TEXT' && openMessage(item)} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {item.deletedForEveryone ? <Text style={styles.deleted}>🚫 Este mensaje fue eliminado</Text> : item.viewOnce ? (
          <View style={styles.onceRow}><Icon name={item.type === 'VIDEO' ? 'videocam' : 'image'} size={23} color="#0066cc" /><Text style={styles.onceText}>{item.viewOnceOpened ? 'Contenido abierto' : 'Ver una vez'}</Text></View>
        ) : item.type === 'IMAGE' && mediaUri ? <Image source={{ uri: mediaUri }} style={styles.image} />
          : item.type === 'VIDEO' && mediaUri ? <Video source={{ uri: mediaUri }} paused controls style={styles.video} />
          : item.type === 'AUDIO' && mediaUri ? <Video source={{ uri: mediaUri }} paused controls style={styles.audio} />
          : item.type === 'DOCUMENT' ? <View style={styles.document}><Icon name="insert-drive-file" size={28} color="#0066cc" /><Text numberOfLines={2}>{item.mediaName || item.content}</Text></View>
          : <Text style={styles.messageText}>{item.content}</Text>}
        <View style={styles.meta}><Text style={styles.time}>{item.isStarred ? '★ ' : ''}{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>{mine && <Text style={[styles.ticks, item.status === 'read' && { color: '#1c9ee8' }]}>{statusIcon(item)}</Text>}</View>
      </TouchableOpacity>
    );
  };

  const otherChats = useMemo(() => chats.filter((item) => item.id !== chatId), [chats, chatId]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      {isLoading && messages.length === 0 ? <ActivityIndicator style={{ flex: 1 }} size="large" color="#0066cc" /> : (
        <FlatList data={Array.isArray(messages) ? messages : []} keyExtractor={(item, index) => String(idOf(item) || `message-${index}`)} renderItem={renderMessage} contentContainerStyle={styles.list} />
      )}
      <View style={styles.inputBar}>
        {!isRecording && <>
          <TouchableOpacity onPress={openAttachmentMenu} style={styles.iconButton}><Icon name="attach-file" size={24} color="#555" /></TouchableOpacity>
          <TextInput style={styles.input} placeholder="Escribe un mensaje…" placeholderTextColor="#888" value={text} onChangeText={onTextChange} multiline />
        </>}
        {text.trim() && !isRecording ? <TouchableOpacity style={styles.send} onPress={() => { void sendMessage(chatId, text.trim()); setText(''); onTextChange(''); }}><Icon name="send" size={21} color="#fff" /></TouchableOpacity>
          : <VoiceRecorder onRecordingChange={setIsRecording} onSend={(uri, durationMs) => void sendMedia(chatId, uri, 'voice-note.m4a', 'audio/mp4', { durationMs })} />}
      </View>

      <Modal visible={Boolean(viewer)} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <View style={styles.viewerBar}><TouchableOpacity onPress={() => setViewer(null)}><Icon name="close" size={28} color="#fff" /></TouchableOpacity><View style={{ flexDirection: 'row', gap: 22 }}>{viewer && !viewer.once && <><TouchableOpacity onPress={() => void saveViewer()}><Icon name="download" size={27} color="#fff" /></TouchableOpacity><TouchableOpacity onPress={() => { setForwarding(viewer.message); setViewer(null); }}><Icon name="forward" size={27} color="#fff" /></TouchableOpacity></>}</View></View>
          {viewer?.message.type === 'VIDEO' ? <Video source={{ uri: viewer.uri }} controls resizeMode="contain" style={{ flex: 1 }} /> : viewer && <Image source={{ uri: viewer.uri }} resizeMode="contain" style={{ flex: 1 }} />}
        </View>
      </Modal>

      <Modal visible={Boolean(forwarding)} transparent animationType="slide" onRequestClose={() => setForwarding(null)}>
        <View style={styles.modalShade}><View style={styles.forwardSheet}><Text style={styles.sheetTitle}>Reenviar a…</Text><FlatList data={otherChats} keyExtractor={(item) => item.id} renderItem={({ item }) => <TouchableOpacity style={styles.forwardRow} onPress={async () => { if (forwarding) await forwardMessage(forwarding, item.id); setForwarding(null); }}><Text style={styles.forwardName}>{item.name}</Text></TouchableOpacity>} /><TouchableOpacity onPress={() => setForwarding(null)}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity></View></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e7ded5' }, list: { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', padding: 9, borderRadius: 10, marginBottom: 8 }, mine: { alignSelf: 'flex-end', backgroundColor: '#d7f9c8' }, theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  messageText: { fontSize: 16, color: '#111' }, deleted: { fontSize: 15, color: '#777', fontStyle: 'italic' },
  image: { width: 230, height: 220, borderRadius: 8 }, video: { width: 230, height: 220, borderRadius: 8 }, audio: { width: 240, height: 46 },
  document: { width: 230, flexDirection: 'row', gap: 8, alignItems: 'center', padding: 8, backgroundColor: '#f1f3f4', borderRadius: 8 },
  onceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7 }, onceText: { color: '#0066cc', fontWeight: '600' },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', gap: 3, marginTop: 4 }, time: { fontSize: 10, color: '#666' }, ticks: { fontSize: 11, color: '#777' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#fff' }, iconButton: { padding: 9 }, input: { flex: 1, minHeight: 40, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#f1f2f3', color: '#111' }, send: { width: 42, height: 42, borderRadius: 21, marginLeft: 7, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' }, viewerBar: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }, forwardSheet: { maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 }, sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 }, forwardRow: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, forwardName: { fontSize: 17 }, cancel: { color: '#0066cc', textAlign: 'center', padding: 15, fontWeight: '700' },
});
