import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CallState } from '../../store/useWebRTCStore';

interface ActiveCallViewProps {
  callState: CallState;
  callerName: string;
  isVideoCall: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

const { width, height } = Dimensions.get('window');

export function ActiveCallView({
  callState,
  callerName,
  isVideoCall,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo
}: ActiveCallViewProps) {
  if (callState === 'idle') return null;

  return (
    <View style={styles.container}>
      {/* Background / Remote Video */}
      {isVideoCall && remoteStream ? (
        <RTCView 
          streamURL={remoteStream.toURL()} 
          style={styles.remoteVideo} 
          objectFit="cover" 
        />
      ) : (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{callerName?.slice(0, 2).toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Local Video Thumbnail */}
      {isVideoCall && callState === 'active' && localStream && !isVideoOff && (
        <View style={styles.localVideoContainer}>
          <RTCView 
            streamURL={localStream.toURL()} 
            style={styles.localVideo} 
            objectFit="cover" 
            zOrder={1}
          />
        </View>
      )}

      {/* Info Overlay */}
      <View style={styles.infoContainer}>
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.statusText}>
          {callState === 'ringing' ? 'Llamada entrante...' : 
           callState === 'calling' ? 'Llamando...' : 'En llamada'}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {callState === 'ringing' ? (
          <>
            <TouchableOpacity style={[styles.button, styles.buttonReject]} onPress={onReject}>
              <Icon name="call-end" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonAccept]} onPress={onAccept}>
              <Icon name={isVideoCall ? "videocam" : "call"} size={28} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, isMuted ? styles.buttonMuted : styles.buttonNormal]} 
              onPress={onToggleMute}
            >
              <Icon name={isMuted ? "mic-off" : "mic"} size={28} color="#fff" />
            </TouchableOpacity>
            
            {isVideoCall && (
              <TouchableOpacity 
                style={[styles.button, isVideoOff ? styles.buttonMuted : styles.buttonNormal]} 
                onPress={onToggleVideo}
              >
                <Icon name={isVideoOff ? "videocam-off" : "videocam"} size={28} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.button, styles.buttonReject]} onPress={onEnd}>
              <Icon name="call-end" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1a1a1a',
    zIndex: 999,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFill,
  },
  avatarContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#333',
    zIndex: 2,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  callerName: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  statusText: {
    fontSize: 18,
    color: '#ccc',
    marginTop: 8,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    zIndex: 2,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginHorizontal: 15,
  },
  buttonReject: {
    backgroundColor: '#ff3b30',
  },
  buttonAccept: {
    backgroundColor: '#34c759',
  },
  buttonNormal: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  buttonMuted: {
    backgroundColor: '#ff3b30',
  },
});
