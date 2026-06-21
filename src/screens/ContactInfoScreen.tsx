import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';

export default function ContactInfoScreen({ route }: any) {
  const { chatName, avatarUrl } = route.params || {};

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarText}>{chatName?.[0] || '?'}</Text>
          )}
        </View>
        <Text style={styles.contactName}>{chatName || 'Contacto'}</Text>
        <Text style={styles.phoneNumber}>+52 55 1234 5678</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionText}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🎥</Text>
            <Text style={styles.actionText}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionText}>Buscar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Archivos, enlaces y documentos</Text>
        <Text style={styles.sectionSubtitle}>0 compartidos</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.dangerRow}>
          <Text style={styles.dangerIcon}>🚫</Text>
          <Text style={styles.dangerText}>Bloquear {chatName}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerRow}>
          <Text style={styles.dangerIcon}>👎</Text>
          <Text style={styles.dangerText}>Reportar contacto</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { 
    alignItems: 'center', backgroundColor: '#fff', 
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#ccc',
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarText: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  contactName: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  phoneNumber: { fontSize: 16, color: '#666', marginTop: 5 },
  actionButtons: { flexDirection: 'row', marginTop: 20, justifyContent: 'space-around', width: '100%' },
  actionBtn: { alignItems: 'center', padding: 10 },
  actionIcon: { fontSize: 24, marginBottom: 5 },
  actionText: { color: '#0066cc', fontSize: 14, fontWeight: '600' },
  section: {
    backgroundColor: '#fff', marginTop: 15, padding: 15,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e0e0e0',
  },
  sectionTitle: { fontSize: 16, color: '#000', fontWeight: 'bold' },
  sectionSubtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dangerIcon: { fontSize: 20, marginRight: 15 },
  dangerText: { color: 'red', fontSize: 16, fontWeight: 'bold' },
});
