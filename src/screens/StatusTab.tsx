import React, { useEffect, useState } from 'react';
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
import { Status, useStatusStore } from '../store/useStatusStore';

export default function StatusTab() {
  const user = useAuthStore(state => state.user);
  const {
    statuses,
    isLoading,
    isUploading,
    loadStatuses,
    createStatus,
    deleteStatus,
  } = useStatusStore();
  const [viewer, setViewer] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Asset | null>(null);
  const [caption, setCaption] = useState('');
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
      );
      setDraft(null);
      setCaption('');
    } catch (error: any) {
      Alert.alert(
        'No se pudo publicar',
        error?.message || 'Revisa la conexión.',
      );
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
              onPress={() => setViewer(item)}
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
        </SafeAreaView>
      </Modal>

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
            </>
          )}
        </NativeSafeAreaView>
      </Modal>
    </SafeAreaView>
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
});
