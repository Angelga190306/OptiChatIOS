import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuthStore } from '../../store/useAuthStore';

interface VoiceRecorderProps {
  onCancel: () => void;
  onSend: (fileUri: string) => void;
}

const audioRecorderPlayer = new (AudioRecorderPlayer as any)();

export function VoiceRecorder({ onCancel, onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const recordUri = useRef('');

  useEffect(() => {
    startRecording();
    return () => {
      if (isRecording) {
        audioRecorderPlayer.stopRecorder();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const path = 'hello.m4a';
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: 'aac',
      };
      const uri = await audioRecorderPlayer.startRecorder(path, audioSet);
      recordUri.current = uri;
      setIsRecording(true);
      audioRecorderPlayer.addRecordBackListener((e: any) => {
        setRecordTime(audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)));
      });
    } catch (e) {
      console.error('Error starting record', e);
      onCancel();
    }
  };

  const stopAndSend = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      onSend(result);
    } catch (e) {
      console.error('Error stopping record', e);
      onCancel();
    }
  };

  const cancelRecording = async () => {
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
    } catch (e) {}
    setIsRecording(false);
    onCancel();
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Icon name="mic" size={20} color="red" />
        <Text style={styles.timeText}>{recordTime}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={cancelRecording} style={styles.cancelBtn}>
          <Icon name="delete" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={stopAndSend} style={styles.sendBtn}>
          <Icon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    minHeight: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#000',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    padding: 5,
    marginRight: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
