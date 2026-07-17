import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView as NativeSafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset, launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { Status, StatusAudienceType, useStatusStore } from '../store/useStatusStore';

export default function StatusTab() {
  const user = useAuthStore((state) => state.user);
  // Selectores por campo para evitar suscribirse a todo el store (re-renders innecesarios).
  const statuses = useStatusStore((s) => s.statuses);
  const isLoading = useStatusStore((s) => s.isLoading);
  const isUploading = useStatusStore((s) => s.isUploading);
  const { loadStatuses, createStatus, deleteStatus, viewStatus, replyToStatus } = useStatusStore.getState();
  const [viewer, setViewer] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Asset | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<{ type: 'ALL_CONTACTS' | 'CONTACTS_EXCEPT' | 'ONLY_SHARE_WITH'; userIds: string[] }>({ type: 'ALL_CONTACTS', userIds: [] });
  const [reply, setReply] = useState('');
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);
  useEffect(() => {
    void loadStatuses();
  }, []);

  const choose = async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (asset?.uri) {
      setCaption('');
      setAudience({ type: 'ALL_CONTACTS', userIds: [] });
      setDraft(asset);
    }
  };
  const publish = async () => {
    if (!draft?.uri) return;
    try {
      await createStatus(
        {
          uri: draft.uri,
          name: draft.fileName || `estado-${Date.now()}`,
          type: draft.type || 'image/jpeg',
        },
        caption.trim(),
        audience,
      );
      setDraft(null);
      setCaption('');
      setAudience({ type: 'ALL_CONTACTS', userIds: [] });
    } catch (error: any) {
      Alert.alert(
        'No se pudo publicar',
        error?.message || 'Revisa la conexión.',
      );
    }
  };

  const openStatus = (item: Status) => {
    setViewer(item);
    setReply('');
    if (!item.isMine && !item.hasViewed) void viewStatus(item._id);
  };

  const sendReply = async () => {
    if (!viewer || viewer.isMine) return;
    const text = reply.trim();
    if (!text) return;
    try {
      await replyToStatus(viewer._id, text);
      setReply('');
      Alert.alert('Enviado', 'Tu respuesta se envió como mensaje al contacto.');
      setViewer(null);
    } catch (error: any) {
      Alert.alert('No se pudo responder', error?.message || 'Revisa la conexión.');
    }
  };
  const avatar = user?.localAvatarUri || resolveMediaUrl(user?.avatarUrl);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Novedades</Text>
      </View>
      <TouchableOpacity style={styles.myStatus} onPress={() => void choose()}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.initial}>{user?.displayName?.[0] || '?'}</Text>
          </View>
        )}
        <View style={styles.plus}>
          <Text style={styles.plusText}>+</Text>
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.name}>Mi estado</Text>
          <Text style={styles.subtitle}>
            {isUploading ? 'Subiendo…' : 'Añade una foto o video'}
          </Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.section}>Recientes</Text>
      {isLoading && statuses.length === 0 ? (
        <ActivityIndicator color="#0066cc" />
      ) : (
        <FlatList
          data={statuses.filter(item => !item.isMine)}
          keyExtractor={item => String(item._id)}
          onRefresh={() => void loadStatuses()}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => openStatus(item)}
            >
              <Image
                source={{
                  uri:
                    resolveMediaUrl(item.userAvatarUrl) ||
                    resolveMediaUrl(item.mediaUrl)!,
                }}
                style={styles.statusAvatar}
              />
              <View>
                <Text style={styles.name}>{item.userName}</Text>
                <Text style={styles.subtitle}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No hay actualizaciones recientes.</Text>
          }
        />
      )}

      <Modal
        visible={Boolean(draft)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDraft(null)}
      >
        <SafeAreaView style={styles.editor} edges={['top', 'bottom']}>
          <View style={styles.editorHeader}>
            <TouchableOpacity
              hitSlop={12}
              style={styles.closeButton}
              onPress={() => setDraft(null)}
            >
              <Icon name="close" size={25} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.editorTitle}>Nuevo estado</Text>
            <TouchableOpacity
              disabled={isUploading}
              style={styles.publishButton}
              onPress={() => void publish()}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.publishText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.preview}>
            {draft &&
              (draft.type?.startsWith('video/') ? (
                <Video
                  source={{ uri: draft.uri! }}
                  controls
                  resizeMode="contain"
                  style={styles.fill}
                />
              ) : (
                <Image
                  source={{ uri: draft.uri! }}
                  resizeMode="contain"
                  style={styles.fill}
                />
              ))}
          </View>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Añade un texto…"
            placeholderTextColor="#aaa"
            maxLength={700}
            multiline
            style={styles.captionInput}
          />
          <AudienceRow audience={audience} onOpen={() => setAudiencePickerOpen(true)} />
        </SafeAreaView>
      </Modal>

      <AudiencePickerModal
        visible={audiencePickerOpen}
        audience={audience}
        onChange={setAudience}
        onClose={() => setAudiencePickerOpen(false)}
      />

      <Modal
        visible={Boolean(viewer)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewer(null)}
      >
        <NativeSafeAreaView style={styles.viewer}>
          {viewer && (
            <>
              <View style={styles.viewerBar}>
                <TouchableOpacity
                  hitSlop={12}
                  style={styles.closeButton}
                  onPress={() => setViewer(null)}
                >
                  <Icon name="close" size={25} color="#fff" />
                </TouchableOpacity>
                {viewer.isMine && (
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Eliminar estado', '¿Eliminar este estado?', [
                        { text: 'Cancelar' },
                        {
                          text: 'Eliminar',
                          style: 'destructive',
                          onPress: async () => {
                            await deleteStatus(viewer._id);
                            setViewer(null);
                          },
                        },
                      ])
                    }
                  >
                    <Icon name="delete" size={27} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              {viewer.mediaType === 'VIDEO' ? (
                <Video
                  source={{ uri: resolveMediaUrl(viewer.mediaUrl)! }}
                  controls
                  style={styles.fill}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={{ uri: resolveMediaUrl(viewer.mediaUrl)! }}
                  style={styles.fill}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.caption}>{viewer.caption}</Text>
              {viewer.isMine ? (
                <View style={styles.viewersBox}>
                  <Text style={styles.viewersTitle}>Vistas ({viewer.viewCount ?? (viewer.viewers?.length || 0)})</Text>
                  {(viewer.viewers || []).length === 0 ? (
                    <Text style={styles.viewersEmpty}>Aún nadie ha visto este estado.</Text>
                  ) : (
                    viewer.viewers!.map((v) => (
                      <View key={v.userId} style={styles.viewerRow}>
                        <Text style={styles.viewerName}>{v.displayName}</Text>
                        <Text style={styles.viewerTime}>{new Date(v.viewedAt).toLocaleString()}</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View style={styles.replyBar}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Responder…"
                    placeholderTextColor="#bbb"
                    value={reply}
                    onChangeText={setReply}
                  />
                  <TouchableOpacity style={styles.replySend} onPress={() => void sendReply()}>
                    <Icon name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </NativeSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function audienceLabel(type: StatusAudienceType, count: number): string {
  if (type === 'ALL_CONTACTS') return 'Todos mis contactos';
  if (type === 'CONTACTS_EXCEPT') return `Excepto ${count}`;
  if (type === 'ONLY_SHARE_WITH') return `Solo compartir con ${count}`;
  return 'Todos mis contactos';
}

function AudienceRow({ audience, onOpen }: { audience: { type: StatusAudienceType; userIds: string[] }; onOpen: () => void }) {
  return (
    <TouchableOpacity style={styles.audienceRow} onPress={onOpen}>
      <Icon name="people" size={20} color="#fff" />
      <Text style={styles.audienceText}>{audienceLabel(audience.type, audience.userIds.length)}</Text>
      <Icon name="chevron-right" size={20} color="#bbb" />
    </TouchableOpacity>
  );
}

function AudiencePickerModal({
  visible, audience, onChange, onClose,
}: {
  visible: boolean;
  audience: { type: StatusAudienceType; userIds: string[] };
  onChange: (next: { type: StatusAudienceType; userIds: string[] }) => void;
  onClose: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  // Los contactos se derivan de los chats 1:1 existentes (paridad con Android).
  const chats = useChatStore((s) => s.chats);
  const contacts = useMemo(
    () => chats.flatMap((c) => (c.participants || []).filter((p) => p.id !== me?.id)),
    [chats, me?.id],
  );

  const setType = (type: StatusAudienceType) => {
    if (type === 'ALL_CONTACTS') onChange({ type, userIds: [] });
    else onChange({ type, userIds: audience.userIds });
  };
  const toggle = (id: string) => {
    const next = audience.userIds.includes(id)
      ? audience.userIds.filter((x) => x !== id)
      : [...audience.userIds, id];
    onChange({ type: audience.type, userIds: next });
  };

  const typeOptions: StatusAudienceType[] = ['ALL_CONTACTS', 'CONTACTS_EXCEPT', 'ONLY_SHARE_WITH'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerShade}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Audiencia del estado</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.pickerDone}>Listo</Text></TouchableOpacity>
          </View>
          {typeOptions.map((t) => (
            <TouchableOpacity key={t} style={styles.pickerOption} onPress={() => setType(t)}>
              <Text style={styles.pickerOptionText}>{audienceLabel(t, audience.userIds.length)}</Text>
              {audience.type === t && <Icon name="check" size={20} color="#25D366" />}
            </TouchableOpacity>
          ))}
          {audience.type !== 'ALL_CONTACTS' && (
            <>
              <Text style={styles.pickerSub}>
                {audience.type === 'CONTACTS_EXCEPT' ? 'Excluir contactos' : 'Compartir solo con'}
              </Text>
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.contactRow} onPress={() => toggle(item.id)}>
                    <Text style={styles.contactName}>{item.displayName || item.phoneNumber}</Text>
                    {audience.userIds.includes(item.id) && <Icon name="check" size={20} color="#25D366" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>No tienes contactos aún.</Text>}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 27, fontWeight: '800', color: '#111' },
  myStatus: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  fallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#8ba4b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#fff', fontSize: 21 },
  plus: {
    position: 'absolute',
    left: 53,
    top: 51,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  plusText: { color: '#fff', fontWeight: '800' },
  statusInfo: { marginLeft: 13 },
  section: {
    padding: 12,
    backgroundColor: '#f4f5f6',
    color: '#666',
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 14 },
  statusAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#0066cc',
  },
  name: { fontSize: 17, fontWeight: '700', color: '#111' },
  subtitle: { color: '#666', marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 40, color: '#777' },
  editor: { flex: 1, backgroundColor: '#111' },
  editorHeader: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  publishButton: {
    minWidth: 86,
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 15,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishText: { color: '#fff', fontWeight: '700' },
  preview: { flex: 1 },
  fill: { flex: 1 },
  captionInput: {
    minHeight: 62,
    maxHeight: 120,
    margin: 14,
    borderRadius: 14,
    backgroundColor: '#2b2b2b',
    color: '#fff',
    padding: 14,
    fontSize: 16,
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerBar: {
    paddingHorizontal: 16,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: { color: '#fff', textAlign: 'center', padding: 20, fontSize: 16 },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  audienceText: { flex: 1, color: '#fff', fontSize: 15 },
  pickerShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  pickerSheet: { maxHeight: '80%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  pickerDone: { color: '#0066cc', fontWeight: '700', fontSize: 16 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  pickerOptionText: { fontSize: 16, color: '#111' },
  pickerSub: { color: '#666', fontWeight: '600', marginTop: 14, marginBottom: 6 },
  pickerEmpty: { textAlign: 'center', color: '#999', marginTop: 20 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  contactName: { fontSize: 16, color: '#111' },
  viewersBox: { paddingHorizontal: 16, paddingBottom: 24 },
  viewersTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  viewersEmpty: { color: '#bbb', fontSize: 14 },
  viewerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,.15)' },
  viewerName: { color: '#fff', fontSize: 15 },
  viewerTime: { color: '#bbb', fontSize: 12 },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 24, gap: 8 },
  replyInput: { flex: 1, color: '#fff', backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16 },
  replySend: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' },
});
