import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { fetchApi } from '../lib/api';

export default function ProfileSetupScreen() {
  const { updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    try {
      setLoading(true);
      setError('');
      
      const res = await fetchApi('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ displayName: displayName.trim(), about: about.trim() }),
      });
      
      if (!res.ok) {
        throw new Error('Error al actualizar el perfil');
      }
      
      const data = await res.json();
      updateUser({ displayName: data.displayName, about: data.about, avatarUrl: data.avatarUrl });
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configura tu perfil</Text>
      <Text style={styles.subtitle}>Escribe tu nombre para que tus contactos te reconozcan.</Text>
      
      <View style={styles.form}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>📷</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Tu Nombre"
          placeholderTextColor="#666"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={30}
        />

        <TextInput
          style={styles.input}
          placeholder="Estado (Info)"
          placeholderTextColor="#666"
          value={about}
          onChangeText={setAbout}
          maxLength={100}
        />
        
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <TouchableOpacity 
          style={[styles.button, (loading || !displayName.trim()) && styles.buttonDisabled]} 
          onPress={handleSave}
          disabled={loading || !displayName.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F0F2F5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#0066cc',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 40,
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 8,
    fontSize: 18,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#0066cc',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    textAlign: 'center',
    fontWeight: '500',
  },
});
