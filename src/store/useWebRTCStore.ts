import { create } from 'zustand';
import { useSocketStore } from './useSocketStore';
import { useAuthStore } from './useAuthStore';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { Alert } from 'react-native';

export type CallState = 'idle' | 'ringing' | 'calling' | 'active' | 'ended';

interface WebRTCState {
  callState: CallState;
  activeCallId: string | null;
  callerId: string | null;
  callerName: string;
  isVideoCall: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: any | null;
  
  setCallState: (state: CallState) => void;
  setCallerId: (id: string | null) => void;
  setCallerName: (name: string) => void;
  setIsVideoCall: (isVideo: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setIsMuted: (isMuted: boolean) => void;
  setIsVideoOff: (isVideoOff: boolean) => void;
  setPeerConnection: (pc: any) => void;

  startCall: (targetUserId: string, targetUserName: string, video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  cleanupCall: () => void;
  setupSocketListeners: () => void;
  removeSocketListeners: () => void;
}

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  callState: 'idle',
  activeCallId: null,
  callerId: null,
  callerName: '',
  isVideoCall: false,
  isMuted: false,
  isVideoOff: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,

  setCallState: (state) => set({ callState: state }),
  setCallerId: (id) => set({ callerId: id }),
  setCallerName: (name) => set({ callerName: name }),
  setIsVideoCall: (isVideo) => set({ isVideoCall: isVideo }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsVideoOff: (isVideoOff) => set({ isVideoOff }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),

  setupSocketListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    socket.on('call-offer', async (data: any) => {
      const state = get();
      if (state.callState !== 'idle') {
        socket.emit('call-rejected', { targetId: data.callerId, reason: 'busy' });
        return;
      }
      set({
        callerId: data.callerId,
        callerName: data.callerName || 'Llamada entrante',
        isVideoCall: data.isVideo,
        callState: 'ringing'
      });

      const pc = createPeerConnection(data.callerId);
      set({ peerConnection: pc });
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    });

    socket.on('call-answer', async (data: any) => {
      const state = get();
      if (state.peerConnection && state.callState === 'calling') {
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        set({ callState: 'active' });
      }
    });

    socket.on('ice-candidate', async (data: any) => {
      const { peerConnection } = get();
      if (peerConnection && data.candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding ice candidate', e);
        }
      }
    });

    socket.on('call-ended', () => {
      get().cleanupCall();
    });

    socket.on('call-rejected', () => {
      get().cleanupCall();
      Alert.alert('Llamada finalizada', 'La llamada fue rechazada o finalizó.');
    });
  },

  removeSocketListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;
    socket.off('call-offer');
    socket.off('call-answer');
    socket.off('ice-candidate');
    socket.off('call-ended');
    socket.off('call-rejected');
  },

  startCall: async (targetUserId, targetUserName, video) => {
    const socket = useSocketStore.getState().socket;
    const user = useAuthStore.getState().user;
    if (!socket || !user) return;

    set({
      callState: 'calling',
      callerId: targetUserId,
      callerName: targetUserName,
      isVideoCall: video
    });

    const stream = await startLocalMedia(video);
    const pc = createPeerConnection(targetUserId);
    set({ peerConnection: pc });

    stream.getTracks().forEach((track: any) => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);

    socket.emit('call-offer', {
      targetId: targetUserId,
      callerName: user.displayName || user.phoneNumber,
      offer,
      isVideo: video
    });
  },

  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { peerConnection, callerId, isVideoCall } = get();
    if (!socket || !peerConnection || !callerId) return;

    const stream = await startLocalMedia(isVideoCall);
    stream.getTracks().forEach((track: any) => {
      peerConnection.addTrack(track, stream);
    });

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('call-answer', {
      targetId: callerId,
      answer
    });
    set({ callState: 'active' });
  },

  rejectCall: () => {
    const socket = useSocketStore.getState().socket;
    const { callerId } = get();
    if (socket && callerId) {
      socket.emit('call-rejected', { targetId: callerId, reason: 'declined' });
    }
    get().cleanupCall();
  },

  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { callerId } = get();
    if (socket && callerId) {
      socket.emit('call-ended', { targetId: callerId });
    }
    get().cleanupCall();
  },

  cleanupCall: () => {
    const { peerConnection, localStream } = get();
    if (peerConnection) {
      peerConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
    }
    set({
      callState: 'idle',
      callerId: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoOff: false
    });
  },

  toggleMute: () => {
    const { localStream } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
      });
      set({ isMuted: !localStream.getAudioTracks()[0].enabled });
    }
  },

  toggleVideo: () => {
    const { localStream } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
      });
      set({ isVideoOff: !localStream.getVideoTracks()[0].enabled });
    }
  }
}));

const createPeerConnection = (targetUserId: string) => {
  const pc: any = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  pc.onicecandidate = (event: any) => {
    const socket = useSocketStore.getState().socket;
    if (event.candidate && socket) {
      socket.emit('ice-candidate', { targetId: targetUserId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event: any) => {
    if (event.streams && event.streams[0]) {
      useWebRTCStore.getState().setRemoteStream(event.streams[0]);
    }
  };

  return pc;
};

const startLocalMedia = async (video: boolean) => {
  try {
    let isFront = true;
    const sourceInfos: any[] = await (mediaDevices.enumerateDevices() as Promise<any[]>);
    let videoSourceId;
    for (let i = 0; i < sourceInfos.length; i++) {
      const sourceInfo: any = sourceInfos[i];
      if (sourceInfo.kind === 'videoinput' && sourceInfo.facing === (isFront ? 'front' : 'environment')) {
        videoSourceId = sourceInfo.deviceId;
      }
    }

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: (video ? {
        mandatory: {
          minWidth: 500,
          minHeight: 300,
          minFrameRate: 30
        },
        facingMode: (isFront ? 'user' : 'environment'),
        optional: (videoSourceId ? [{ sourceId: videoSourceId }] : [])
      } : false) as any
    });
    useWebRTCStore.getState().setLocalStream(stream);
    return stream;
  } catch (e) {
    console.error('Error getting user media', e);
    Alert.alert('Error', 'Error accediendo a cámara o micrófono.');
    throw e;
  }
};
