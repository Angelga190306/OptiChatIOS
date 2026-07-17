import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, TextInput, ScrollView, Animated, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useChatStore } from '../store/useChatStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MultiMediaEditor'>;

export default function MultiMediaEditorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const assets = route.params?.assets || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState('');
  // 0 = desactivado; 1-5 = número de vistas permitidas (viewOnceLimit del backend).
  const [viewOnceLimit, setViewOnceLimit] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  // `paths`/`currentPath` alimentan el overlay SVG de dibujo visible en pantalla.
  // Las anotaciones NO se "hornean" aún en el archivo enviado: requiere
  // `react-native-view-shot` (captureRef) que no está instalado (pendiente de
  // verificación en dispositivo). Por eso los setters no se usan por ahora.
  const [paths, _setPaths] = useState<string[][]>(assets.map(() => []));
  const [currentPath, _setCurrentPath] = useState<string>('');

  const scale = new Animated.Value(1);
  const translateX = new Animated.Value(0);
  const translateY = new Animated.Value(0);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale } }], { useNativeDriver: true });
  const onPanEvent = Animated.event([{ nativeEvent: { translationX: translateX, translationY: translateY } }], { useNativeDriver: true });

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      if (event.nativeEvent.scale < 1) {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    }
  };

  // Envía TODOS los assets seleccionados (no solo el actual). El caption se envía
  // como un mensaje de texto independiente tras el primer medio (paridad con el
  // flujo multi-send de Android). `viewOnce` aplica a todos los medios.
  const handleSend = async () => {
    const chatId = route.params?.chatId;
    if (!chatId) {
      navigation.goBack();
      return;
    }
    const { sendMedia, sendMessage } = useChatStore.getState();
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const uri = asset?.image?.uri;
      if (!uri) continue;
      const mime = asset.type || 'image/jpeg';
      const name = asset.filename || `media-${Date.now()}-${i}`;
      try {
        await sendMedia(chatId, uri, name, mime, {
          viewOnce: viewOnceLimit > 0,
          viewOnceLimit: viewOnceLimit > 0 ? viewOnceLimit : undefined,
        });
        if (i === 0 && caption.trim()) await sendMessage(chatId, caption.trim());
      } catch (error) {
        console.warn('No se pudo enviar un medio del editor', error);
      }
    }
    navigation.navigate('Chat', { chatId });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Toolbar */}
      <View style={styles.topToolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.toolIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Recorte', 'El recorte aún no está disponible en iOS.')}>
            <Icon name="crop" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Emoji', 'Los stickers/emoji requieren horneado de anotaciones (pendiente).')}>
            <Icon name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Texto', 'El texto sobre la imagen requiere horneado de anotaciones (pendiente).')}>
            <Icon name="text" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsDrawing(!isDrawing)} style={styles.iconButton}>
            <Icon name="pencil" size={24} color={isDrawing ? "#25D366" : "#fff"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Image Area with Gestures */}
      <View style={styles.imageContainer}>
        <PanGestureHandler onGestureEvent={onPanEvent} maxPointers={2}>
          <Animated.View style={styles.imageWrapper}>
            <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
              <Animated.View style={[styles.imageWrapper, { transform: [{ scale }, { translateX }, { translateY }] }]}>
                <Image source={{ uri: assets[currentIndex]?.image.uri }} style={styles.image} />
                
                {/* SVG Drawing Canvas Overlay */}
                <Svg style={StyleSheet.absoluteFill}>
                  {paths[currentIndex]?.map((p, i) => (
                    <Path key={i} d={p} stroke="#ff0000" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                  {currentPath ? <Path d={currentPath} stroke="#ff0000" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                </Svg>

              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomToolbar}>
        {/* Carousel */}
        {assets.length > 1 && (
          <ScrollView horizontal style={styles.carousel} showsHorizontalScrollIndicator={false}>
            {assets.map((asset: any, index: number) => (
              <TouchableOpacity key={index} onPress={() => setCurrentIndex(index)} style={[styles.thumbnailContainer, currentIndex === index && styles.thumbnailActive]}>
                <Image source={{ uri: asset.image.uri }} style={styles.thumbnail} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input & Send Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <Icon name="add-circle-outline" size={24} color="#fff" />
            <TextInput
              style={styles.textInput}
              placeholder="Añade un comentario..."
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
            />
            <TouchableOpacity
              onPress={() => setViewOnceLimit((n) => (n >= 5 ? 0 : n + 1))}
              style={[styles.viewOnceBtn, viewOnceLimit > 0 && styles.viewOnceActive]}
            >
              <Icon name="timer-outline" size={20} color={viewOnceLimit > 0 ? "#fff" : "#999"} />
              <Text style={[styles.viewOnceText, viewOnceLimit > 0 && styles.viewOnceTextActive]}>
                {viewOnceLimit > 0 ? viewOnceLimit : 1}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Icon name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topToolbar: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, zIndex: 10 },
  iconButton: { padding: 5, marginLeft: 10 },
  toolIcons: { flexDirection: 'row' },
  imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageWrapper: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%', resizeMode: 'contain' },
  bottomToolbar: { paddingBottom: 20, paddingTop: 10, paddingHorizontal: 10 },
  carousel: { maxHeight: 60, marginBottom: 10 },
  thumbnailContainer: { width: 50, height: 50, marginRight: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbnailActive: { borderColor: '#25D366' },
  thumbnail: { width: '100%', height: '100%', resizeMode: 'cover' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f1f1f', borderRadius: 24, paddingHorizontal: 15, height: 48 },
  textInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16 },
  viewOnceBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  viewOnceActive: { backgroundColor: '#25D366', borderRadius: 12, paddingHorizontal: 4 },
  viewOnceText: { color: '#999', fontSize: 12, fontWeight: 'bold', marginLeft: 2 },
  viewOnceTextActive: { color: '#fff' },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});
