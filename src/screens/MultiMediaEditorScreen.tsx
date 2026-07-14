import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, SafeAreaView, TextInput, ScrollView, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MultiMediaEditor'>;

export default function MultiMediaEditorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const assets = route.params?.assets || [];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<string[][]>(assets.map(() => []));
  const [currentPath, setCurrentPath] = useState<string>('');
  
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

  const handleSend = () => {
    const asset = assets[currentIndex];
    // In a real implementation we would render the SVG onto the image before sending.
    // For now we just pass the viewOnce flag and caption back to ChatScreen or send directly.
    navigation.navigate('Chat', {
      chatId: route.params?.chatId,
      mediaToSend: { uri: asset.image.uri, caption, viewOnce, mime: asset.type }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Toolbar */}
      <View style={styles.topToolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.toolIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <Icon name="crop" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Icon name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
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
            <TouchableOpacity onPress={() => setViewOnce(!viewOnce)} style={[styles.viewOnceBtn, viewOnce && styles.viewOnceActive]}>
              <Icon name="timer-outline" size={20} color={viewOnce ? "#fff" : "#999"} />
              <Text style={[styles.viewOnceText, viewOnce && styles.viewOnceTextActive]}>1</Text>
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
