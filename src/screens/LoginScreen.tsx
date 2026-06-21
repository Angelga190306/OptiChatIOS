import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { fetchApi } from '../lib/api';

const COUNTRIES = [
  { name: 'México', code: '+52', flag: '🇲🇽' },
  { name: 'Estados Unidos', code: '+1', flag: '🇺🇸' },
  { name: 'España', code: '+34', flag: '🇪🇸' },
  { name: 'Argentina', code: '+54', flag: '🇦🇷' },
  { name: 'Colombia', code: '+57', flag: '🇨🇴' },
  { name: 'Chile', code: '+56', flag: '🇨🇱' },
  { name: 'Perú', code: '+51', flag: '🇵🇪' },
  { name: 'Ecuador', code: '+593', flag: '🇪🇨' },
  { name: 'Venezuela', code: '+58', flag: '🇻🇪' },
  { name: 'Brasil', code: '+55', flag: '🇧🇷' },
  { name: 'Reino Unido', code: '+44', flag: '🇬🇧' },
  { name: 'Alemania', code: '+49', flag: '🇩🇪' },
  { name: 'Francia', code: '+33', flag: '🇫🇷' },
  { name: 'Italia', code: '+39', flag: '🇮🇹' },
];

export default function LoginScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSendCode = async () => {
    if (phoneNumber.length < 10) {
      setError('Ingresa un número válido de al menos 10 dígitos');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const formattedPhone = selectedCountry.code + phoneNumber;
      const res = await fetchApi('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar código');
      }
      
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Error al enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const formattedPhone = selectedCountry.code + phoneNumber;
      const res = await fetchApi('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ 
          phoneNumber: formattedPhone, 
          code: otp,
          deviceName: "OptiChat iOS" 
        }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Código incorrecto');
      }
      
      const data = await res.json();
      useAuthStore.getState().login(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      setError(err.message || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OptiChat</Text>
      
      <View style={styles.form}>
        {step === 1 ? (
          <>
            <Text style={styles.subtitle}>Ingresa tu número de teléfono</Text>
            
            <TouchableOpacity style={styles.countrySelector} onPress={() => setModalVisible(true)}>
              <Text style={styles.countrySelectorText}>
                {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="1234 5678"
              placeholderTextColor="#666"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
              keyboardType="phone-pad"
            />
            
            {error ? <Text style={styles.error}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[styles.button, (loading || phoneNumber.length < 10) && styles.buttonDisabled]} 
              onPress={handleSendCode}
              disabled={loading || phoneNumber.length < 10}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Recibir código por SMS</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Ingresa el código de 6 dígitos</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#666"
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            {error ? <Text style={styles.error}>{error}</Text> : null}
            
            <TouchableOpacity 
              style={[styles.button, (loading || otp.length !== 6) && styles.buttonDisabled]} 
              onPress={handleVerifyCode}
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verificar Código</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: 15 }}>
              <Text style={{ color: '#0066cc', textAlign: 'center', fontWeight: 'bold' }}>Cambiar número</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu país</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code + item.name}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.countryItem}
                  onPress={() => {
                    setSelectedCountry(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.countryItemText}>{item.flag} {item.name}</Text>
                  <Text style={styles.countryItemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#0066cc',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  countrySelectorText: {
    fontSize: 16,
    color: '#000',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  countryItemText: {
    fontSize: 16,
  },
  countryItemCode: {
    fontSize: 16,
    color: '#666',
  },
});
