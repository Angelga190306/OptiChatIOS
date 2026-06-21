import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export default function CallsTab() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const loadCalls = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/calls/history');
      if (res.ok) {
        const data = await res.json();
        setCalls(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Llamadas</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#0066cc" />
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id || Math.random().toString()}
          refreshing={loading}
          onRefresh={loadCalls}
          renderItem={({ item }) => (
            <View style={styles.callItem}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{item.callerName?.[0] || '?'}</Text>
              </View>
              <View style={styles.callInfo}>
                <Text style={[styles.callName, item.missed && { color: 'red' }]}>
                  {item.callerName || 'Desconocido'}
                </Text>
                <View style={styles.callDetailsRow}>
                  <Text style={styles.callDetails}>
                    {item.type === 'incoming' ? '↙ ' : '↗ '}
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callButton}>
                <Text style={{ fontSize: 24 }}>📞</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes llamadas recientes.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 15, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  callItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#ccc',
    justifyContent: 'center', alignItems: 'center', marginRight: 15,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  callInfo: { flex: 1 },
  callName: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  callDetailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  callDetails: { fontSize: 13, color: '#666' },
  callButton: { padding: 10 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16 },
});
