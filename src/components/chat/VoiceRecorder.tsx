import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AudioRecorderPlayer, { AudioEncoderAndroidType, AudioSourceAndroidType, AVEncoderAudioQualityIOSType } from 'react-native-audio-recorder-player';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Props { onSend: (fileUri: string, durationMs: number) => void; onCancel?: () => void; onRecordingChange?: (recording: boolean) => void; }
const recorder = new (AudioRecorderPlayer as any)();

export function VoiceRecorder({ onSend, onCancel, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const duration = useRef(0);
  const recordingRef = useRef(false);
  const lockedRef = useRef(false);

  const updateRecording = (value: boolean) => { recordingRef.current = value; setRecording(value); onRecordingChange?.(value); };
  const updateLocked = (value: boolean) => { lockedRef.current = value; setLocked(value); };
  const start = async () => {
    if (recordingRef.current) return;
    try {
      duration.current = 0; updateLocked(false); updateRecording(true);
      await recorder.startRecorder(`voice-${Date.now()}.m4a`, {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC, AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high, AVNumberOfChannelsKeyIOS: 1, AVFormatIDKeyIOS: 'aac',
      });
      recorder.addRecordBackListener((event: any) => { duration.current = Math.floor(event.currentPosition); setRecordTime(recorder.mmssss(duration.current)); });
    } catch { updateRecording(false); onCancel?.(); }
  };
  const finish = async (send: boolean) => {
    if (!recordingRef.current) return;
    try { const uri = await recorder.stopRecorder(); recorder.removeRecordBackListener(); const ms = duration.current; updateRecording(false); updateLocked(false); setRecordTime('00:00'); if (send && ms > 300) onSend(uri, ms); else onCancel?.(); }
    catch { updateRecording(false); updateLocked(false); onCancel?.(); }
  };
  useEffect(() => () => { if (recordingRef.current) void recorder.stopRecorder(); recorder.removeRecordBackListener(); }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { void start(); },
    onPanResponderMove: (_, gesture) => { if (gesture.dy < -65 && recordingRef.current) updateLocked(true); },
    onPanResponderRelease: () => { if (recordingRef.current && !lockedRef.current) void finish(true); },
    onPanResponderTerminate: () => { if (recordingRef.current && !lockedRef.current) void finish(false); },
  }), []);

  if (!recording) return <View {...panResponder.panHandlers} style={styles.mic}><Icon name="mic" size={23} color="#fff" /></View>;
  return <View {...panResponder.panHandlers} style={styles.recording}>
    <View style={styles.time}><Icon name="fiber-manual-record" size={16} color="#d32f2f" /><Text style={styles.timeText}>{recordTime}</Text></View>
    {!locked ? <View style={styles.lockHint}><Icon name="lock" size={17} color="#777" /><Text style={styles.hint}>Desliza arriba para bloquear</Text></View> : <View style={styles.controls}><TouchableOpacity onPress={() => void finish(false)}><Icon name="delete" size={26} color="#666" /></TouchableOpacity><Icon name="lock" size={19} color="#0066cc" /><TouchableOpacity style={styles.send} onPress={() => void finish(true)}><Icon name="send" size={21} color="#fff" /></TouchableOpacity></View>}
  </View>;
}

const styles = StyleSheet.create({ mic: { width: 42, height: 42, borderRadius: 21, marginLeft: 7, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' }, recording: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' }, time: { flexDirection: 'row', alignItems: 'center', gap: 5 }, timeText: { fontSize: 16, color: '#111', fontVariant: ['tabular-nums'] }, lockHint: { flexDirection: 'row', alignItems: 'center', gap: 5 }, hint: { color: '#777', fontSize: 12 }, controls: { flexDirection: 'row', alignItems: 'center', gap: 18 }, send: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center' } });
