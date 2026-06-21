import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { fetchJson } from '../lib/api';
import { resolveMediaUrl } from '../lib/offlineFiles';
import { useSocketStore } from '../store/useSocketStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { CallHistoryItem } from '../types';

export default function CallsTab() {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const startCall = useWebRTCStore((state) => state.startCall);
  const socket = useSocketStore((state) => state.socket);
  const load = async () => {
    try { setLoading(true); setCalls((await fetchJson<{ calls: CallHistoryItem[] }>('/calls/history')).calls || []); }
    catch { /* mantener historial visible */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!socket) return;
    const handler = () => void load();
    socket.on('call-history-updated', handler);
    return () => { socket.off('call-history-updated', handler); };
  }, [socket]);
  const subtitle = (call: CallHistoryItem) => {
    const direction = call.direction === 'INCOMING' ? '↙' : '↗';
    const state: Record<string, string> = { MISSED: 'Perdida', REJECTED: 'Rechazada', CANCELED: 'Cancelada', COMPLETED: 'Finalizada', ANSWERED: 'En curso', RINGING: 'Llamando' };
    return `${direction} ${state[call.status] || call.status} · ${new Date(call.startedAt).toLocaleString()}`;
  };
  return <SafeAreaView style={styles.container} edges={['top']}><View style={styles.header}><Text style={styles.title}>Llamadas</Text></View>{loading && calls.length === 0 ? <ActivityIndicator style={{ marginTop: 30 }} color="#0066cc" /> : <FlatList data={calls} keyExtractor={(item) => item.id} onRefresh={() => void load()} refreshing={loading} renderItem={({ item }) => {
    const uri = resolveMediaUrl(item.otherUser.avatarUrl);
    const name = item.otherUser.displayName || item.otherUser.phoneNumber;
    const missed = item.status === 'MISSED' && item.direction === 'INCOMING';
    return <View style={styles.row}>{uri ? <Image source={{ uri }} style={styles.avatar} /> : <View style={styles.fallback}><Text style={styles.initial}>{name[0]}</Text></View>}<View style={{ flex: 1 }}><Text style={[styles.name, missed && { color: '#c62828' }]}>{name}</Text><Text style={styles.subtitle}>{subtitle(item)}</Text>{item.durationSeconds != null && <Text style={styles.duration}>{Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, '0')}</Text>}</View><TouchableOpacity onPress={() => void startCall(item.otherUser.id, name, item.type === 'VIDEO')}><Icon name={item.type === 'VIDEO' ? 'videocam' : 'call'} size={26} color="#0066cc" /></TouchableOpacity></View>;
  }} ListEmptyComponent={<Text style={styles.empty}>No tienes llamadas recientes.</Text>} />}</SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, header: { padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' }, title: { fontSize: 27, fontWeight: '800', color: '#111' }, row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 26 }, fallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#8ba4b8', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#fff', fontSize: 20, fontWeight: '700' }, name: { fontSize: 17, fontWeight: '700', color: '#111' }, subtitle: { color: '#666', fontSize: 12, marginTop: 3 }, duration: { color: '#777', fontSize: 11, marginTop: 2 }, empty: { textAlign: 'center', marginTop: 50, color: '#777' } });
