import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { useAuthStore } from '../store/useAuthStore';
import { Status, useStatusStore } from '../store/useStatusStore';

export default function StatusTab() {
  const user = useAuthStore((state) => state.user);
  const { statuses, isLoading, isUploading, loadStatuses, createStatus, deleteStatus } = useStatusStore();
  const [viewer, setViewer] = useState<Status | null>(null);
  useEffect(() => { void loadStatuses(); }, []);
  const add = async () => {
    const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, quality: 0.9 });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    await createStatus({ uri: asset.uri, name: asset.fileName || `estado-${Date.now()}`, type: asset.type || 'image/jpeg' }).catch((e) => Alert.alert('Error', e.message));
  };
  const avatar = user?.localAvatarUri || resolveMediaUrl(user?.avatarUrl);
  return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.header}><Text style={styles.title}>Novedades</Text></View><TouchableOpacity style={styles.myStatus} onPress={() => void add()}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <View style={styles.fallback}><Text style={styles.initial}>{user?.displayName?.[0] || '?'}</Text></View>}<View style={styles.plus}><Text style={{ color: '#fff', fontWeight: '800' }}>+</Text></View><View style={{ marginLeft: 13 }}><Text style={styles.name}>Mi estado</Text><Text style={styles.subtitle}>{isUploading ? 'Subiendo…' : 'Añade una foto o video'}</Text></View></TouchableOpacity><Text style={styles.section}>Recientes</Text>{isLoading && statuses.length === 0 ? <ActivityIndicator color="#0066cc" /> : <FlatList data={statuses.filter((item) => !item.isMine)} keyExtractor={(item) => item._id} onRefresh={() => void loadStatuses()} refreshing={isLoading} renderItem={({ item }) => <TouchableOpacity style={styles.row} onPress={() => setViewer(item)}><Image source={{ uri: resolveMediaUrl(item.userAvatarUrl) || resolveMediaUrl(item.mediaUrl)! }} style={styles.statusAvatar} /><View><Text style={styles.name}>{item.userName}</Text><Text style={styles.subtitle}>{new Date(item.createdAt).toLocaleString()}</Text></View></TouchableOpacity>} ListEmptyComponent={<Text style={styles.empty}>No hay actualizaciones recientes.</Text>} />}
    <Modal visible={Boolean(viewer)} animationType="fade" onRequestClose={() => setViewer(null)}>{viewer && <View style={styles.viewer}><View style={styles.viewerBar}><TouchableOpacity onPress={() => setViewer(null)}><Icon name="close" size={28} color="#fff" /></TouchableOpacity>{viewer.isMine && <TouchableOpacity onPress={() => Alert.alert('Eliminar estado', '¿Eliminar este estado?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteStatus(viewer._id); setViewer(null); } }])}><Icon name="delete" size={27} color="#fff" /></TouchableOpacity>}</View>{viewer.mediaType === 'VIDEO' ? <Video source={{ uri: resolveMediaUrl(viewer.mediaUrl)! }} controls style={{ flex: 1 }} resizeMode="contain" /> : <Image source={{ uri: resolveMediaUrl(viewer.mediaUrl)! }} style={{ flex: 1 }} resizeMode="contain" />}<Text style={styles.caption}>{viewer.caption}</Text></View>}</Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, title: { fontSize: 27, fontWeight: '800', color: '#111' }, myStatus: { flexDirection: 'row', alignItems: 'center', padding: 15 }, avatar: { width: 54, height: 54, borderRadius: 27 }, fallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#8ba4b8', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontSize: 21 }, plus: { position: 'absolute', left: 53, top: 51, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }, section: { padding: 12, backgroundColor: '#f4f5f6', color: '#666', fontWeight: '600' }, row: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 14 }, statusAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#0066cc' }, name: { fontSize: 17, fontWeight: '700', color: '#111' }, subtitle: { color: '#666', marginTop: 3 }, empty: { textAlign: 'center', marginTop: 40, color: '#777' }, viewer: { flex: 1, backgroundColor: '#000' }, viewerBar: { paddingTop: 54, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between' }, caption: { color: '#fff', textAlign: 'center', padding: 20, fontSize: 16 } });
