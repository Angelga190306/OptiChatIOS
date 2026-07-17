import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, SafeAreaView } from 'react-native';
import { CameraRoll, PhotoIdentifier, iosRequestReadWriteGalleryPermission } from '@react-native-camera-roll/camera-roll';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MultiMediaPicker'>;

export default function MultiMediaPickerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();
  const [photos, setPhotos] = useState<PhotoIdentifier[]>([]);
  const [selected, setSelected] = useState<PhotoIdentifier[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const permission = await iosRequestReadWriteGalleryPermission();
      if (permission !== 'granted') return;

      const result = await CameraRoll.getPhotos({
        first: 100,
        assetType: 'All',
        include: ['playableDuration', 'filename', 'imageSize'],
      });
      setPhotos(result.edges);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (photo: PhotoIdentifier) => {
    setSelected(prev => {
      const isSelected = prev.find(p => p.node.image.uri === photo.node.image.uri);
      if (isSelected) return prev.filter(p => p.node.image.uri !== photo.node.image.uri);
      return [...prev, photo];
    });
  };

  const handleNext = () => {
    if (selected.length === 0) return;
    navigation.replace('MultiMediaEditor', { assets: selected.map(s => s.node), chatId: route.params?.chatId });
  };

  const renderItem = ({ item }: { item: PhotoIdentifier }) => {
    const isSelected = selected.findIndex(p => p.node.image.uri === item.node.image.uri);
    return (
      <TouchableOpacity onPress={() => toggleSelection(item)} style={styles.imageContainer}>
        <Image source={{ uri: item.node.image.uri }} style={styles.image} />
        {item.node.type.startsWith('video') && (
          <View style={styles.videoBadge}>
            <Icon name="videocam" size={14} color="#fff" />
            <Text style={styles.videoDuration}>{item.node.image.playableDuration ? Math.round(item.node.image.playableDuration) + 's' : ''}</Text>
          </View>
        )}
        {isSelected !== -1 && (
          <View style={styles.selectedOverlay}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isSelected + 1}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enviar a...</Text>
        <TouchableOpacity onPress={handleNext} style={styles.headerButton} disabled={selected.length === 0}>
          {selected.length > 0 && <Icon name="arrow-forward" size={28} color="#25D366" />}
        </TouchableOpacity>
      </View>
      <FlatList
        data={photos}
        keyExtractor={item => item.node.image.uri}
        numColumns={COLUMN_COUNT}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#000' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerButton: { width: 40, alignItems: 'center' },
  list: { paddingBottom: 20 },
  imageContainer: { width: IMAGE_SIZE, height: IMAGE_SIZE, margin: 1 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  videoBadge: { position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', alignItems: 'center' },
  videoDuration: { color: '#fff', fontSize: 12, marginLeft: 3 },
  selectedOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  badge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: 'bold' },
});
