import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal,
  Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { CameraRoll, iosRequestAddOnlyGalleryPermission } from '@react-native-camera-roll/camera-roll';
import { pick, types } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import { getApiUrl, fetchJson } from '../lib/api';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { subscribeToScreenshots } from '../lib/screenshotDetector';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useSocketStore } from '../store/useSocketStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { Message } from '../types';

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;
const idOf = (message: Message) => message._id || message.id || '';
// Referencia estable para evitar re-renders infinitos: si el store aún no tiene mensajes
// para este chat, devolvemos siempre el MISMO array vacío en lugar de uno nuevo por render.
const EMPTY: Message[] = [];

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation<any>();
  const { chatId, chatName, avatarUrl, mediaToSend } = route.params;
  const chats = useChatStore((state) => state.chats);
  const messages = useChatStore((state) => state.messagesByChat?.[chatId] ?? EMPTY);
  const isLoading = useChatStore((state) => state.isLoadingMessages);
  const { loadMessages, sendMessage, sendMedia, toggleStarred, deleteMessage, bulkDelete, forwardMessage } = useChatStore.getState();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const startCall = useWebRTCStore((state) => state.startCall);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [viewer, setViewer] = useState<{ message: Message; uri: string; once: boolean } | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = chats.find((item) => item.id === chatId);
  const target = Array.isArray(chat?.participants) ? chat?.participants.find((participant) => participant?.id !== user?.id) : undefined;

  const openChatMenu = () => {
    const isBlocked = target?.blockedByMe;
    ActionSheetIOS.showActionSheetWithOptions({
      options: ['Cancelar', 'Buscar', 'Archivos', 'Reportar', isBlocked ? 'Desbloquear contacto' : 'Bloquear contacto'],
      cancelButtonIndex: 0,
      destructiveButtonIndex: 4,
    }, async (index) => {
      if (index === 1) {
        setSearching(true);
        setSearchQuery('');
      } else if (index === 2) {
        navigation.navigate('ContactInfo', { chatId, chatName, avatarUrl: avatarUrl || chat?.avatarUrl });
      } else if (index === 3) {
        setReporting(true);
        setReportText('');
      } else if (index === 4) {
        if (!target) return;
        try {
          if (isBlocked) {
            await fetchJson(`/users/${target.id}/block`, { method: 'DELETE' });
            useChatStore.getState().updateBlockStatus(target.id, false);
          } else {
            await fetchJson(`/users/${target.id}/block`, { method: 'POST' });
            useChatStore.getState().updateBlockStatus(target.id, true);
          }
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    const selectedMessages = messages.filter(m => selectedIds.has(idOf(m)));
    if (selectedMessages.length === 0) return;
    
    const allMine = selectedMessages.every(m => m.senderId === user?.id);
    const allWithinHour = selectedMessages.every(m => Date.now() - new Date(m.createdAt).getTime() <= 3600000);
    const canDeleteForEveryone = allMine && allWithinHour;

    const options = ['Cancelar', 'Eliminar para mí'];
    if (canDeleteForEveryone) options.push('Eliminar para todos');

    ActionSheetIOS.showActionSheetWithOptions({
      options, cancelButtonIndex: 0, destructiveButtonIndex: canDeleteForEveryone ? [1, 2] : 1,
    }, async (index) => {
      if (index === 0) return;
      const scope = index === 2 ? 'everyone' : 'me';
      try {
        const messageIds = selectedMessages.map(idOf).filter(Boolean);
        await bulkDelete(chatId, messageIds, scope);
        setSelectedIds(new Set());
      } catch (e: any) {
        Alert.alert('Error', 'Algunos mensajes no se pudieron eliminar: ' + e.message);
      }
    });
  };

  const submitReport = async () => {
    if (!target) return;
    const reason = reportText.trim();
    if (reason.length < 3) {
      Alert.alert('Muy corto', 'El reporte debe tener al menos 3 caracteres.');
      return;
    }
    try {
      await fetchJson(`/users/${target.id}/report`, { method: 'POST', body: JSON.stringify({ message: reason }) });
      setReporting(false);
      setReportText('');
      Alert.alert('Enviado', 'Tu reporte se envió al equipo de soporte.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => !m.deletedForEveryone && m.content && m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useLayoutEffect(() => {
    if (selectedIds.size > 0) {
      navigation.setOptions({
        title: `${selectedIds.size} seleccionados`,
        headerTitle: undefined,
        headerLeft: () => (
          <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={{ marginLeft: 16 }}>
            <Icon name="close" size={25} color="#fff" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <TouchableOpacity onPress={handleBulkDelete}><Icon name="delete" size={25} color="#fff" /></TouchableOpacity>
          </View>
        ),
      });
      return;
    }

    navigation.setOptions({
      title: chatName,
      headerLeft: undefined,
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
          <TouchableOpacity onPress={openChatMenu}><Icon name="more-vert" size={25} color="#fff" /></TouchableOpacity>
        </View>
      ),
    });
  }, [chat, target, chatName, avatarUrl, selectedIds]);

  useEffect(() => {
    void loadMessages(chatId);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      useSocketStore.getState().socket?.emit('typing_stop', { conversationId: chatId });
    };
  }, [chatId]);

  useEffect(() => {
    if (mediaToSend) {
      void sendMedia(chatId, mediaToSend.uri, `media-${Date.now()}`, mediaToSend.mime, { viewOnce: mediaToSend.viewOnce });
      if (mediaToSend.caption) void sendMessage(chatId, mediaToSend.caption);
      // Clear the params so it doesn't resend on re-render
      navigation.setParams({ mediaToSend: undefined });
    }
  }, [mediaToSend]);

  useEffect(() => {
    if (viewer && viewer.once) {
      const unsubscribe = subscribeToScreenshots(() => {
        void useSocketStore.getState().reportScreenshot(chatId, viewer.message._id || viewer.message.id);
        Alert.alert('Aviso', 'Se ha notificado al remitente que has tomado una captura de pantalla.');
      });
      return () => {
        if (typeof unsubscribe === 'function') (unsubscribe as () => void)();
        else if (unsubscribe && typeof (unsubscribe as any).remove === 'function') (unsubscribe as any).remove();
      };
    }
  }, [viewer]);

  const onTextChange = (value: string) => {
    setText(value);
    const socket = useSocketStore.getState().socket;
    socket?.emit(value ? 'typing_start' : 'typing_stop', { conversationId: chatId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit('typing_stop', { conversationId: chatId }), 1600);
  };

  const choosePhotoOrVideo = () => {
    navigation.navigate('MultiMediaPicker', { chatId });
  };

  const openCamera = () => {
    navigation.navigate('CameraCapture', { chatId });
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
    options: ['Cancelar', 'Cámara', 'Foto o video', 'Documento'], cancelButtonIndex: 0,
  }, (index) => { if (index === 1) void openCamera(); if (index === 2) void choosePhotoOrVideo(); if (index === 3) void chooseDocument(); });

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

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const showMessageActions = (message: Message) => {
    if (message.status === 'pending' || message.viewOnce || message.deletedForEveryone) return;
    
    // Si ya estamos seleccionando, un long-press simplemente alterna la selección
    if (selectedIds.size > 0) {
      toggleSelection(idOf(message));
      return;
    }

    const own = message.senderId === user?.id;
    const withinHour = Date.now() - new Date(message.createdAt).getTime() <= 3600000;
    const labels = ['Cancelar', 'Seleccionar múltiples'];
    const actions: Array<() => void> = [() => undefined, () => toggleSelection(idOf(message))];
    
    if (message.type === 'TEXT') { labels.push('Copiar'); actions.push(() => Clipboard.setString(message.content)); }
    labels.push(message.isStarred ? 'Quitar destacado' : 'Destacar'); actions.push(() => void toggleStarred(message));
    labels.push('Reenviar'); actions.push(() => setForwarding(message));
    labels.push('Eliminar para mí'); actions.push(() => void deleteMessage(message, 'me').catch((e) => Alert.alert('Error', e.message)));
    if (own && withinHour) { labels.push('Eliminar para todos'); actions.push(() => void deleteMessage(message, 'everyone').catch((e) => Alert.alert('Error', e.message))); }
    
    ActionSheetIOS.showActionSheetWithOptions({ options: labels, cancelButtonIndex: 0, destructiveButtonIndex: labels.map((x, i) => x.startsWith('Eliminar') ? i : -1).filter((i) => i >= 0) }, (index) => actions[index]?.());
  };

  const statusIcon = (message: Message) => message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : message.status === 'pending' ? '◷' : message.status === 'failed' ? '!' : '✓';

  // Etiqueta de mensajes view-once: muestra el límite (①-⑤) y, para el remitente,
  // cuántas vistas restantes quedan. El backend envía `viewOnceRemaining` y
  // `viewOnceOpened` (ver server/src/routes/chats.ts:14-29).
  const viewOnceLabel = (message: Message) => {
    if (message.viewOnceOpened) return 'Contenido abierto';
    const limit = Math.max(1, Math.min(5, message.viewOnceLimit ?? 1));
    const circles = ['①', '②', '③', '④', '⑤'][limit - 1];
    const remaining = message.viewOnceRemaining;
    const isMine = message.senderId === user?.id;
    if (isMine && typeof remaining === 'number') {
      return `${circles} ${remaining} ${remaining === 1 ? 'vista restante' : 'vistas restantes'}`;
    }
    return `${circles} Ver ${limit === 1 ? 'una vez' : `${limit} veces`}`;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'DATE_SEPARATOR') {
      return (
        <View style={styles.dateSeparatorContainer}>
          <Text style={styles.dateSeparatorText}>{item.date}</Text>
        </View>
      );
    }
    const message = item as Message;
    const mine = message.senderId === user?.id;
    const mediaUri = message.localUri || resolveMediaUrl(message.mediaUrl);
    const isSelected = selectedIds.has(idOf(message));
    
    return (
      <View style={[styles.messageWrapper, isSelected && styles.selectedWrapper]}>
        <TouchableOpacity activeOpacity={0.8} onLongPress={() => showMessageActions(message)} onPress={() => selectedIds.size > 0 ? toggleSelection(idOf(message)) : (message.type !== 'TEXT' && openMessage(message))} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          {message.deletedForEveryone ? <Text style={styles.deleted}>🚫 Este mensaje fue eliminado</Text> : message.viewOnce ? (
            <View style={styles.onceRow}>
              <Icon name={message.type === 'VIDEO' ? 'videocam' : 'image'} size={23} color="#0066cc" />
              <Text style={styles.onceText}>{viewOnceLabel(message)}</Text>
            </View>
          ) : message.type === 'IMAGE' && mediaUri ? <Image source={{ uri: mediaUri }} style={styles.image} />
            : message.type === 'VIDEO' && mediaUri ? <Video source={{ uri: mediaUri }} paused controls style={styles.video} />
            : message.type === 'AUDIO' && mediaUri ? <Video source={{ uri: mediaUri }} paused controls style={styles.audio} />
            : message.type === 'DOCUMENT' ? <View style={styles.document}><Icon name="insert-drive-file" size={28} color="#0066cc" /><Text numberOfLines={2}>{message.mediaName || message.content}</Text></View>
            : <Text style={styles.messageText}>{message.content}</Text>}
          <View style={styles.meta}><Text style={styles.time}>{message.isStarred ? '★ ' : ''}{new Date(message.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>{mine && <Text style={[styles.ticks, message.status === 'read' && { color: '#1c9ee8' }]}>{statusIcon(message)}</Text>}</View>
        </TouchableOpacity>
      </View>
    );
  };

  const otherChats = useMemo(() => chats.filter((item) => item.id !== chatId), [chats, chatId]);

  const formatDayLabel = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (sameDay(date, today)) return 'Hoy';
    if (sameDay(date, yesterday)) return 'Ayer';
    const withinWeek = (today.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
    if (withinWeek) return date.toLocaleDateString('es-ES', { weekday: 'long' });
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formattedMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    const result: any[] = [];
    let lastDate = '';
    messages.forEach((msg) => {
      const key = new Date(msg.createdAt).toDateString();
      if (key !== lastDate) {
        result.push({ type: 'DATE_SEPARATOR', date: formatDayLabel(msg.createdAt), id: `sep-${key}` });
        lastDate = key;
      }
      result.push(msg);
    });
    return result;
  }, [messages]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      {isLoading && messages.length === 0 ? <ActivityIndicator style={{ flex: 1 }} size="large" color="#0066cc" /> : (
        <FlatList data={formattedMessages} keyExtractor={(item, index) => String(item.type === 'DATE_SEPARATOR' ? item.id : idOf(item) || `msg-${index}`)} renderItem={renderItem} contentContainerStyle={styles.list} />
      )}
      {target?.blockedByMe ? (
        <View style={styles.blockedBar}>
          <Text style={styles.blockedText}>Has bloqueado a este contacto.</Text>
          <TouchableOpacity onPress={() => openChatMenu()}><Text style={styles.unblockText}>Desbloquear</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputBar}>
          {!isRecording && <>
            <TouchableOpacity onPress={openAttachmentMenu} style={styles.iconButton}><Icon name="attach-file" size={24} color="#555" /></TouchableOpacity>
            <TextInput style={styles.input} placeholder="Escribe un mensaje…" placeholderTextColor="#888" value={text} onChangeText={onTextChange} multiline />
          </>}
          {text.trim() && !isRecording ? <TouchableOpacity style={styles.send} onPress={() => { void sendMessage(chatId, text.trim()); setText(''); onTextChange(''); }}><Icon name="send" size={21} color="#fff" /></TouchableOpacity>
            : <VoiceRecorder onRecordingChange={setIsRecording} onSend={(uri, durationMs) => void sendMedia(chatId, uri, 'voice-note.m4a', 'audio/mp4', { durationMs })} />}
        </View>
      )}

      <Modal visible={Boolean(viewer)} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <View style={styles.viewerBar}><TouchableOpacity onPress={() => setViewer(null)}><Icon name="close" size={28} color="#fff" /></TouchableOpacity><View style={{ flexDirection: 'row', gap: 22 }}>{viewer && !viewer.once && <><TouchableOpacity onPress={() => void saveViewer()}><Icon name="download" size={27} color="#fff" /></TouchableOpacity><TouchableOpacity onPress={() => { setForwarding(viewer.message); setViewer(null); }}><Icon name="forward" size={27} color="#fff" /></TouchableOpacity></>}</View></View>
          {viewer?.message.type === 'VIDEO' ? <Video source={{ uri: viewer.uri }} controls resizeMode="contain" style={{ flex: 1 }} /> : viewer && <Image source={{ uri: viewer.uri }} resizeMode="contain" style={{ flex: 1 }} />}
        </View>
      </Modal>

      <Modal visible={Boolean(forwarding)} transparent animationType="slide" onRequestClose={() => setForwarding(null)}>
        <View style={styles.modalShade}><View style={styles.forwardSheet}><Text style={styles.sheetTitle}>Reenviar a…</Text><FlatList data={otherChats} keyExtractor={(item) => item.id} renderItem={({ item }) => <TouchableOpacity style={styles.forwardRow} onPress={async () => { if (forwarding) await forwardMessage(forwarding, item.id); setForwarding(null); }}><Text style={styles.forwardName}>{item.name}</Text></TouchableOpacity>} /><TouchableOpacity onPress={() => setForwarding(null)}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity></View></View>
      </Modal>

      <Modal visible={reporting} transparent animationType="slide" onRequestClose={() => setReporting(false)}>
        <View style={styles.modalShade}><View style={styles.forwardSheet}>
          <Text style={styles.sheetTitle}>Reportar a {target?.displayName || chatName}</Text>
          <Text style={styles.searchHint}>Describe el motivo (3–1000 caracteres). Se enviará al equipo de soporte.</Text>
          <TextInput style={styles.reportInput} placeholder="Motivo del reporte…" placeholderTextColor="#999" value={reportText} onChangeText={setReportText} multiline autoFocus />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 }}>
            <TouchableOpacity onPress={() => setReporting(false)}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void submitReport()}><Text style={[styles.cancel, { fontWeight: '700', color: '#d32f2f' }]}>Enviar reporte</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={searching} animationType="slide" onRequestClose={() => setSearching(false)}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TouchableOpacity onPress={() => setSearching(false)} style={{ paddingRight: 8 }}><Icon name="arrow-back" size={24} color="#0066cc" /></TouchableOpacity>
            <TextInput style={styles.searchInput} placeholder="Buscar en este chat…" placeholderTextColor="#999" autoFocus value={searchQuery} onChangeText={setSearchQuery} />
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => idOf(item)}
            ListEmptyComponent={<Text style={styles.searchEmpty}>{searchQuery.trim() ? 'Sin resultados' : 'Escribe para buscar mensajes en este chat.'}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchRow} onPress={() => { setSearching(false); }}>
                <Text style={styles.searchSender}>{item.senderName || ''}</Text>
                <Text numberOfLines={3} style={styles.searchContent}>{item.content}</Text>
                <Text style={styles.searchTime}>{new Date(item.createdAt).toLocaleString()}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e7ded5' }, list: { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },
  dateSeparatorContainer: { alignSelf: 'center', backgroundColor: '#e1f5fe', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginVertical: 12 }, dateSeparatorText: { fontSize: 12, color: '#004d40', fontWeight: '500' },
  messageWrapper: { width: '100%', marginBottom: 8, paddingHorizontal: 4, borderRadius: 8 },
  selectedWrapper: { backgroundColor: 'rgba(0, 102, 204, 0.15)' },
  bubble: { maxWidth: '82%', padding: 9, borderRadius: 10 }, mine: { alignSelf: 'flex-end', backgroundColor: '#d7f9c8' }, theirs: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  messageText: { fontSize: 16, color: '#111' }, deleted: { fontSize: 15, color: '#777', fontStyle: 'italic' },
  image: { width: 230, height: 220, borderRadius: 8 }, video: { width: 230, height: 220, borderRadius: 8 }, audio: { width: 240, height: 46 },
  document: { width: 230, flexDirection: 'row', gap: 8, alignItems: 'center', padding: 8, backgroundColor: '#f1f3f4', borderRadius: 8 },
  onceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7 }, onceText: { color: '#0066cc', fontWeight: '600' },
  meta: { flexDirection: 'row', alignSelf: 'flex-end', gap: 3, marginTop: 4 }, time: { fontSize: 10, color: '#666' }, ticks: { fontSize: 11, color: '#777' },
  blockedBar: { padding: 16, backgroundColor: '#f9f9f9', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' }, blockedText: { color: '#555', fontSize: 15 }, unblockText: { color: '#0066cc', fontSize: 15, fontWeight: '600', marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#fff' }, iconButton: { padding: 9 }, input: { flex: 1, minHeight: 40, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#f1f2f3', color: '#111' }, send: { width: 42, height: 42, borderRadius: 21, marginLeft: 7, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' }, viewerBar: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }, forwardSheet: { maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 }, sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 }, forwardRow: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, forwardName: { fontSize: 17 }, cancel: { color: '#0066cc', textAlign: 'center', padding: 15, fontWeight: '700' },
  searchHint: { color: '#666', fontSize: 13, marginBottom: 10 }, reportInput: { minHeight: 90, maxHeight: 160, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, color: '#111', textAlignVertical: 'top' },
  searchContainer: { flex: 1, backgroundColor: '#fff' }, searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, searchInput: { flex: 1, fontSize: 17, color: '#111' }, searchEmpty: { textAlign: 'center', color: '#999', marginTop: 40, paddingHorizontal: 30 }, searchRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' }, searchSender: { fontSize: 13, fontWeight: '700', color: '#0066cc' }, searchContent: { fontSize: 15, color: '#222', marginTop: 3 }, searchTime: { fontSize: 11, color: '#888', marginTop: 4 },
});
