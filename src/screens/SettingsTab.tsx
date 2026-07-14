import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { fetchJson } from '../lib/api';
import { cacheOwnAvatar, resolveMediaUrl } from '../lib/offlineFiles';
import { useAuthStore } from '../store/useAuthStore';
import { BackupInfo, User } from '../types';

interface Device {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  location: string | null;
  createdAt: string;
}

export default function SettingsTab() {
  const { user, updateUser, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || 'Disponible');
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<BackupInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [backupError, setBackupError] = useState<string | null>(null);

  const loadBackup = async () => {
    try {
      setBackupError(null);
      setBackup(await fetchJson<BackupInfo>('/backups/info'));
    } catch (error: any) {
      setBackupError(error?.message || 'No se pudo consultar la copia.');
      throw error;
    }
  };
  const loadDevices = async () =>
    setDevices(
      (await fetchJson<{ devices: Device[] }>('/users/linked-devices'))
        .devices || [],
    );
  useEffect(() => {
    void loadBackup().catch(() => undefined);
  }, []);

  const saveProfile = async () => {
    setBusy(true);
    try {
      const updated = await fetchJson<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ displayName: name.trim(), about: about.trim() }),
      });
      updateUser(updated);
      setProfileOpen(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setBusy(false);
    }
  };
  const changeAvatar = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'avatar.jpg',
      type: asset.type || 'image/jpeg',
    } as any);
    setBusy(true);
    try {
      const response = await fetchJson<{ avatarUrl: string }>(
        '/users/me/avatar',
        { method: 'POST', body: form },
      );
      const localAvatarUri = await cacheOwnAvatar(
        response.avatarUrl,
        asset.uri,
      );
      updateUser({ avatarUrl: response.avatarUrl, localAvatarUri });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setBusy(false);
    }
  };
  const chooseFrequency = () => {
    const values = ['Diaria', 'Semanal', 'Mensual', 'Ninguna'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancelar', ...values], cancelButtonIndex: 0 },
      async index => {
        if (!index) return;
        const frequency = values[index - 1];
        await fetchJson('/users/me/backup-settings', {
          method: 'PUT',
          body: JSON.stringify({ frequency }),
        });
        updateUser({ backupFrequency: frequency as any });
        await loadBackup();
      },
    );
  };
  const manualBackup = async () => {
    setBusy(true);
    try {
      await fetchJson('/backups/manual', {
        method: 'POST',
        body: JSON.stringify({ clientSettings: {} }),
      });
      await loadBackup();
      Alert.alert('Copia terminada', 'Tus datos se guardaron correctamente.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };
  const restore = () =>
    Alert.alert(
      'Restaurar copia',
      'Se combinarán los datos de la copia con tu cuenta.',
      [
        { text: 'Cancelar' },
        {
          text: 'Restaurar',
          onPress: async () => {
            setBusy(true);
            try {
              await fetchJson('/backups/restore', {
                method: 'POST',
                body: '{}',
              });
              Alert.alert(
                'Restaurada',
                'Vuelve a Chats para sincronizar el contenido.',
              );
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  const avatar = user?.localAvatarUri || resolveMediaUrl(user?.avatarUrl);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <Text style={styles.title}>Configuración</Text>
        <TouchableOpacity
          style={styles.profile}
          onPress={() => setProfileOpen(true)}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.initial}>
                {user?.displayName?.[0] || '?'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.displayName || 'Usuario'}</Text>
            <Text style={styles.subtitle}>{user?.about || 'Disponible'}</Text>
          </View>
          <Icon name="chevron-right" size={25} color="#888" />
        </TouchableOpacity>
        <View style={styles.group}>
          <Row
            icon="devices"
            title="Dispositivos vinculados"
            onPress={async () => {
              setDevicesOpen(true);
              await loadDevices().catch(e => Alert.alert('Error', e.message));
            }}
          />
          <Row
            icon="backup"
            title="Copias de seguridad"
            subtitle={
              backup?.lastBackup
                ? `Última: ${new Date(backup.lastBackup).toLocaleString()} · ${
                    backup.formattedSize
                  }`
                : 'Sin copia'
            }
            onPress={() => {
              setBackupOpen(true);
              void loadBackup().catch(() => undefined);
            }}
          />
          <Row
            icon="lock"
            title="Privacidad"
            subtitle="Bloqueados, mensajes temporales"
            onPress={() => setPrivacyOpen(true)}
          />
          <Row
            icon="notifications"
            title="Notificaciones"
            subtitle="Se administran desde Ajustes de iOS"
            onPress={() =>
              Alert.alert(
                'Notificaciones',
                'Abre Ajustes de iOS → OptiChat → Notificaciones.',
              )
            }
          />
        </View>
        <TouchableOpacity
          style={styles.logout}
          onPress={() =>
            Alert.alert(
              'Cerrar sesión',
              'Los chats offline permanecerán cifrados por iOS en este dispositivo.',
              [
                { text: 'Cancelar' },
                {
                  text: 'Cerrar sesión',
                  style: 'destructive',
                  onPress: logout,
                },
              ],
            )
          }
        >
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setProfileOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <ModalHeader
            title="Editar perfil"
            close={() => setProfileOpen(false)}
          />
          <TouchableOpacity
            onPress={() => void changeAvatar()}
            style={{ alignSelf: 'center', marginVertical: 20 }}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.bigAvatar} />
            ) : (
              <View style={[styles.fallback, styles.bigAvatar]}>
                <Text style={styles.initial}>?</Text>
              </View>
            )}
            <Text style={styles.changePhoto}>Cambiar foto</Text>
          </TouchableOpacity>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre"
            style={styles.input}
          />
          <TextInput
            value={about}
            onChangeText={setAbout}
            placeholder="Info."
            style={styles.input}
          />
          <TouchableOpacity
            style={styles.primary}
            onPress={() => void saveProfile()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={backupOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setBackupOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <ModalHeader
            title="Copia de seguridad"
            close={() => setBackupOpen(false)}
          />
          {backupError && (
            <TouchableOpacity style={styles.errorCard} onPress={() => void loadBackup().catch(() => undefined)}>
              <Text style={styles.errorTitle}>No se pudo consultar la copia</Text>
              <Text style={styles.errorDetail}>{backupError}</Text>
              <Text style={styles.retry}>Tocar para reintentar</Text>
            </TouchableOpacity>
          )}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Última copia</Text>
            <Text>
              {backup?.lastBackup
                ? new Date(backup.lastBackup).toLocaleString()
                : 'Nunca'}
            </Text>
            <Text style={styles.subtitle}>
              {backup?.formattedSize || '0 B'} · {backup?.messages || 0}{' '}
              mensajes · {backup?.mediaFiles || 0} archivos
            </Text>
          </View>
          <TouchableOpacity style={styles.card} onPress={chooseFrequency}>
            <Text style={styles.cardTitle}>Copia automática</Text>
            <Text>
              {backup?.frequency || user?.backupFrequency || 'Ninguna'}
            </Text>
            <Text style={styles.subtitle}>
              Las copias diarias se ejecutan a las 2:00 AM
              (America/Mexico_City).
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => void manualBackup()}
          >
            <Text style={styles.primaryText}>Crear copia ahora</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={restore}>
            <Text style={styles.secondaryText}>Restaurar copia</Text>
          </TouchableOpacity>
          {busy && (
            <ActivityIndicator style={{ marginTop: 15 }} color="#0066cc" />
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={devicesOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDevicesOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <ModalHeader
            title="Dispositivos vinculados"
            close={() => setDevicesOpen(false)}
          />
          <FlatList
            data={devices}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.device}>
                <Icon name="smartphone" size={28} color="#0066cc" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.deviceInfo || 'Dispositivo'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {item.location || item.ipAddress || ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Cerrar sesión', '¿Cerrar esta sesión?', [
                      { text: 'Cancelar' },
                      {
                        text: 'Cerrar',
                        style: 'destructive',
                        onPress: async () => {
                          await fetchJson(`/users/linked-devices/${item.id}`, {
                            method: 'DELETE',
                          });
                          await loadDevices();
                        },
                      },
                    ])
                  }
                >
                  <Icon name="logout" size={24} color="#c62828" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No hay otros dispositivos.</Text>
            }
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={privacyOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPrivacyOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <ModalHeader title="Privacidad" close={() => setPrivacyOpen(false)} />
          
          <View style={styles.card}>
            <Row
              icon="block"
              title="Contactos bloqueados"
              subtitle="0 contactos"
              onPress={() => Alert.alert('Bloqueados', 'Gestión de bloqueados disponible próximamente.')}
            />
            <Row
              icon="timer"
              title="Mensajes temporales"
              subtitle="Desactivados"
              onPress={() => Alert.alert('Mensajes Temporales', 'Configuración de mensajes temporales en desarrollo.')}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ icon, title, subtitle, onPress }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Icon name={icon} size={25} color="#0066cc" />
      <View style={{ flex: 1, marginLeft: 13 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-right" size={24} color="#999" />
    </TouchableOpacity>
  );
}
function ModalHeader({ title, close }: any) {
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={close} hitSlop={12} style={styles.modalClose}>
        <Icon name="close" size={25} color="#0066cc" />
      </TouchableOpacity>
      <Text style={styles.modalTitle}>{title}</Text>
      <View style={styles.modalSpacer} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f5' },
  title: {
    fontSize: 27,
    fontWeight: '800',
    padding: 16,
    backgroundColor: '#fff',
    color: '#111',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    gap: 13,
  },
  avatar: { width: 62, height: 62, borderRadius: 31 },
  fallback: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#8ba4b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 19, fontWeight: '700', color: '#111' },
  subtitle: { color: '#666', fontSize: 13, marginTop: 3 },
  group: { marginTop: 16, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: { fontSize: 16, color: '#111' },
  logout: {
    marginTop: 18,
    padding: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  logoutText: { color: '#c62828', fontSize: 16, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#f3f4f5', padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingBottom: 10,
  },
  modalClose: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#b7cae8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  modalSpacer: { width: 44 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  bigAvatar: { width: 120, height: 120, borderRadius: 60 },
  changePhoto: {
    color: '#0066cc',
    textAlign: 'center',
    marginTop: 7,
    fontWeight: '600',
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 13,
    color: '#111',
  },
  primary: {
    marginTop: 20,
    backgroundColor: '#0066cc',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    marginTop: 12,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0066cc',
    alignItems: 'center',
  },
  secondaryText: { color: '#0066cc', fontWeight: '700' },
  card: {
    marginTop: 13,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 11,
  },
  cardTitle: { fontWeight: '700', fontSize: 16, color: '#111' },
  device: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  empty: { textAlign: 'center', marginTop: 50, color: '#777' },
  errorCard: { marginTop: 13, padding: 15, borderRadius: 11, borderWidth: 1, borderColor: '#ef9a9a', backgroundColor: '#ffebee' },
  errorTitle: { color: '#b3261e', fontWeight: '700' },
  errorDetail: { color: '#7f1d1d', marginTop: 4 },
  retry: { color: '#0066cc', fontWeight: '700', marginTop: 8 },
});
