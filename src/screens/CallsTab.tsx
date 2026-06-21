import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

export default function CallsTab() {
  const mockCalls = [
    { id: '1', name: 'Mamá', type: 'incoming', time: 'Ayer, 20:30', missed: false },
    { id: '2', name: 'Juan', type: 'outgoing', time: 'Ayer, 18:15', missed: false },
    { id: '3', name: 'Trabajo', type: 'incoming', time: 'Lunes, 09:00', missed: true },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Llamadas</Text>
      </View>
      <FlatList
        data={mockCalls}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.callItem}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={styles.callInfo}>
              <Text style={[styles.callName, item.missed && { color: 'red' }]}>{item.name}</Text>
              <View style={styles.callDetailsRow}>
                <Text style={styles.callDetails}>
                  {item.type === 'incoming' ? '↙ ' : '↗ '}
                  {item.time}
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
    </View>
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
  emptyText: { textAlign: 'center', marginTop: 20, color: '#999' },
});
