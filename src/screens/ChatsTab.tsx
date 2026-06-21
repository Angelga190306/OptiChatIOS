import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { Chat } from '../types';

export default function ChatsTab() {
  const navigation = useNavigation<any>();
  const chats = useChatStore((state) => state.chats);
  const loading = useChatStore((state) => state.isLoadingChats);
  const connected = useChatStore((state) => state.isOnline);
  const user = useAuthStore((state) => state.user);
  const { loadChats, setActiveChat, createChat } = useChatStore.getState();
  const startCall = useWebRTCStore((state) => state.startCall);
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => { void loadChats(); }, []);

  const targetOf = (chat: Chat) => chat.participants.find((participant) => participant.id !== user?.id);
  const openChat = (chat: Chat) => {
    setActiveChat(chat.id);
    navigation.navigate('Chat', { chatId: chat.id, chatName: chat.name, avatarUrl: chat.avatarUrl || undefined });
  };
  const openQuickActions = (chat: Chat) => {
    const target = targetOf(chat);
    ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancelar', 'Info. del contacto', 'Llamada', 'Videollamada'], cancelButtonIndex: 0 }, (index) => {
      if (index === 1) navigation.navigate('ContactInfo', { chatId: chat.id, chatName: chat.name, avatarUrl: chat.avatarUrl || undefined });
      if (index === 2 && target) void startCall(target.id, target.displayName || target.phoneNumber, false);
      if (index === 3 && target) void startCall(target.id, target.displayName || target.phoneNumber, true);
    });
  };

  const create = async () => {
    try {
      const id = await createChat(phone.trim());
      setPhone(''); setNewChatVisible(false);
      const chat = useChatStore.getState().chats.find((item) => item.id === id);
      if (chat) openChat(chat);
    } catch (error: any) { Alert.alert('No se pudo crear el chat', error?.message || 'Revisa el número.'); }
  };

  const renderItem = ({ item }: { item: Chat }) => {
    const target = targetOf(item);
    const uri = resolveMediaUrl(item.avatarUrl);
    return (
      <TouchableOpacity style={styles.row} onPress={() => openChat(item)}>
        <TouchableOpacity onPress={() => openQuickActions(item)}>
          {uri ? <Image source={{ uri }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text></View>}
          {target?.isOnline && <View style={styles.onlineDot} />}
        </TouchableOpacity>
        <View style={styles.center}>
          <View style={styles.topLine}><Text style={styles.name}>{item.name}</Text><Text style={styles.time}>{item.lastMessageTime ? new Date(item.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text></View>
          <View style={styles.bottomLine}><Text style={styles.preview} numberOfLines={1}>{item.isTyping ? 'escribiendo…' : item.lastMessage || 'No hay mensajes'}</Text>{item.unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View>}</View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><View><Text style={styles.title}>Chats</Text><Text style={[styles.connection, { color: connected ? '#228b45' : '#b3261e' }]}>{connected ? 'Conectado' : 'Sin conexión · mensajes en espera'}</Text></View><TouchableOpacity onPress={() => setNewChatVisible(true)}><Icon name="chat" size={27} color="#0066cc" /></TouchableOpacity></View>
      {loading && chats.length === 0 ? <ActivityIndicator style={{ flex: 1 }} color="#0066cc" /> : <FlatList data={chats} keyExtractor={(item) => item.id} renderItem={renderItem} refreshing={loading} onRefresh={() => void loadChats()} ListEmptyComponent={<Text style={styles.empty}>No tienes chats activos.</Text>} />}
      <Modal visible={newChatVisible} transparent animationType="fade" onRequestClose={() => setNewChatVisible(false)}><View style={styles.shade}><View style={styles.dialog}><Text style={styles.dialogTitle}>Nuevo chat</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Número con código de país" style={styles.input} /><View style={styles.actions}><TouchableOpacity onPress={() => setNewChatVisible(false)}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={() => void create()}><Text style={styles.create}>Crear</Text></TouchableOpacity></View></View></View></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, header: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, title: { fontSize: 27, fontWeight: '800', color: '#111' }, connection: { fontSize: 11, marginTop: 2 },
  row: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' }, avatar: { width: 54, height: 54, borderRadius: 27 }, avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#8ba4b8', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 21, fontWeight: '700' }, onlineDot: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#32c45b', borderWidth: 2, borderColor: '#fff' },
  center: { flex: 1, marginLeft: 12 }, topLine: { flexDirection: 'row', justifyContent: 'space-between' }, bottomLine: { flexDirection: 'row', alignItems: 'center', marginTop: 5 }, name: { fontSize: 17, fontWeight: '700', color: '#111' }, time: { fontSize: 12, color: '#777' }, preview: { flex: 1, fontSize: 14, color: '#666' }, badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' }, empty: { marginTop: 60, textAlign: 'center', color: '#777' },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }, dialog: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20 }, dialogTitle: { fontSize: 20, fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 9, padding: 12, marginTop: 16, color: '#111' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 18 }, cancel: { color: '#666', fontWeight: '600' }, create: { color: '#0066cc', fontWeight: '700' },
});
