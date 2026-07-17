import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CameraCapture'>;

export default function CameraCaptureScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const [hasPermission, setHasPermission] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const device = useCameraDevice(cameraPosition);
  // ⚠️ PENDIENTE: react-native-vision-camera instalado es v5 (Nitro), pero esta
  // pantalla usa la API v4 (props `photo`/`video`/`audio`, `Camera.requestXPermission`,
  // `camera.current.takePhoto`/`startRecording`). En v5 se usa `outputs`,
  // `useCameraPermission`/`useMicrophonePermission`, `CameraPhotoOutput.capturePhoto`
  // y `Recorder`. La migración requiere verificación en dispositivo físico y se
  // deja pendiente. Se conservan las llamadas v4 con casts `any` para no alterar el
  // comportamiento existente y mantener el type-check del resto del proyecto limpio.
  const camera = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const cameraStatus = await (Camera as any).requestCameraPermission();
      const microphoneStatus = await (Camera as any).requestMicrophonePermission();
      setHasPermission(cameraStatus === 'granted' && microphoneStatus === 'granted');
    })();
  }, []);

  const takePhoto = async () => {
    if (camera.current) {
      const photo = await camera.current.takePhoto({ flash: flashOn ? 'on' : 'off' });
      navigation.replace('MultiMediaEditor', {
        chatId: route.params?.chatId,
        assets: [{
          image: { uri: `file://${photo.path}`, playableDuration: 0 },
          type: 'image/jpeg',
          filename: 'photo.jpg'
        }]
      });
    }
  };

  const openGallery = () => {
    navigation.replace('MultiMediaPicker', { chatId: route.params?.chatId });
  };

  const startRecording = () => {
    if (camera.current) {
      setIsRecording(true);
      camera.current.startRecording({
        onRecordingFinished: (video: any) => {
          setIsRecording(false);
          navigation.replace('MultiMediaEditor', {
            chatId: route.params?.chatId,
            assets: [{
              image: { uri: `file://${video.path}`, playableDuration: video.duration },
              type: 'video/mp4',
              filename: 'video.mp4'
            }]
          });
        },
        onRecordingError: (error: any) => {
          setIsRecording(false);
          console.error(error);
        }
      });
    }
  };

  const stopRecording = async () => {
    if (camera.current && isRecording) {
      await camera.current.stopRecording();
    }
  };

  if (!hasPermission || !device) {
    return <View style={styles.container}><Text style={{ color: '#fff' }}>Solicitando permisos de cámara...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        {...({ photo: true, video: true, audio: true } as any)}
      />
      
      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setFlashOn((v) => !v)}>
          <Icon name={flashOn ? 'flash' : 'flash-off'} size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.iconButton} onPress={openGallery}>
          <Icon name="images" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Shutter Button */}
        <TouchableOpacity
          onPress={takePhoto}
          onLongPress={startRecording}
          onPressOut={stopRecording}
          style={styles.shutterContainer}
        >
          <View style={[styles.shutterRing, isRecording && styles.recordingRing]}>
            <View style={isRecording ? styles.shutterSquare : styles.shutterCircle} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setCameraPosition(p => p === 'back' ? 'front' : 'back')} style={styles.iconButton}>
          <Icon name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  topControls: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  bottomControls: { position: 'absolute', bottom: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  shutterContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  shutterRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  recordingRing: { borderColor: '#ff0000' },
  shutterCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  shutterSquare: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#ff0000' },
});
