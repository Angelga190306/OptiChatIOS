import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { fetchApi } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export default function StatusTab() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const loadStatuses = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/status');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Estados</Text>
      </View>

      <TouchableOpacity style={styles.myStatusContainer}>
        <View style={styles.avatarPlaceholder}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarText}>{user?.displayName?.[0] || '?'}</Text>
          )}
          <View style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </View>
        </View>
        <View style={styles.myStatusInfo}>
          <Text style={styles.myStatusTitle}>Mi estado</Text>
          <Text style={styles.myStatusSubtitle}>Añade una actualización</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Recientes</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#0066cc" />
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.statusItem}>
              <View style={styles.statusAvatarPlaceholder}>
                <Text style={styles.avatarText}>{item.user?.displayName?.[0] || '?'}</Text>
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusName}>{item.user?.displayName || 'Desconocido'}</Text>
                <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay actualizaciones recientes.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  myStatusContainer: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  addButton: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#0066cc', width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  myStatusInfo: { marginLeft: 15 },
  myStatusTitle: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  myStatusSubtitle: { fontSize: 14, color: '#666' },
  sectionTitle: { padding: 15, fontSize: 14, fontWeight: 'bold', color: '#666', backgroundColor: '#fafafa' },
  statusItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusAvatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#ccc',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0066cc',
  },
  statusInfo: { marginLeft: 15 },
  statusName: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  timeText: { fontSize: 13, color: '#666' },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },
});
