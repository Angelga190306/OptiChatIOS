import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export default function SettingsTab() {
  const { user, logout } = useAuthStore();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      <TouchableOpacity style={styles.profileSection}>
        <View style={styles.avatarPlaceholder}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarText}>{user?.displayName?.[0] || '?'}</Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.displayName || 'Usuario'}</Text>
          <Text style={styles.profileAbout}>{user?.about || 'Disponible'}</Text>
        </View>
        <Text style={styles.qrIcon}>📱</Text>
      </TouchableOpacity>

      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsItem}>
          <Text style={styles.settingsIcon}>💻</Text>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>Dispositivos Vinculados</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Text style={styles.settingsIcon}>🔑</Text>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>Cuenta</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Text style={styles.settingsIcon}>💬</Text>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>Chats</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <Text style={styles.settingsIcon}>🔔</Text>
          <View style={styles.settingsItemTextContainer}>
            <Text style={styles.settingsItemTitle}>Notificaciones</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { padding: 15, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  profileSection: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 15, marginTop: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e0e0e0',
  },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#ccc',
    justifyContent: 'center', alignItems: 'center', marginRight: 15,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  profileAbout: { fontSize: 14, color: '#666', marginTop: 2 },
  qrIcon: { fontSize: 24 },
  settingsGroup: {
    backgroundColor: '#fff', marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e0e0e0',
  },
  settingsItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingsIcon: { fontSize: 24, marginRight: 15 },
  settingsItemTextContainer: { flex: 1 },
  settingsItemTitle: { fontSize: 16, color: '#000' },
  logoutButton: {
    backgroundColor: '#fff', marginTop: 20, padding: 15,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  logoutButtonText: { color: 'red', fontSize: 16, fontWeight: 'bold' },
});
