import { Alert } from 'react-native';
import { create } from 'zustand';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { fetchJson } from '../lib/api';
import { useSocketStore } from './useSocketStore';

export type CallState = 'idle' | 'ringing' | 'calling' | 'ringback' | 'active';

interface WebRTCState {
  callState: CallState;
  activeCallId: string | null;
  targetUserId: string | null;
  callerName: string;
  isVideoCall: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  videoUpgradePending: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: any | null;
  remoteIceQueue: any[];
  localIceQueue: any[];
  offerRegistered: boolean;
  startCall: (targetUserId: string, targetUserName: string, video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  requestVideoUpgrade: () => void;
  cleanupCall: () => void;
  setupSocketListeners: () => void;
  removeSocketListeners: () => void;
  setRemoteStream: (stream: MediaStream | null) => void;
}

const newCallId = () => `ios-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

async function getLocalMedia(video: boolean) {
  return mediaDevices.getUserMedia({
    audio: true,
    video: video ? { facingMode: 'user', width: 640, height: 480, frameRate: 30 } as any : false,
  });
}

async function enableVideo() {
  const state = useWebRTCStore.getState();
  if (!state.peerConnection) return false;
  if (state.localStream?.getVideoTracks().length) {
    state.localStream.getVideoTracks().forEach((track: any) => { track.enabled = true; });
    useWebRTCStore.setState({ isVideoOff: false, isVideoCall: true });
    return true;
  }
  const cameraStream = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: 640, height: 480 } as any });
  const track = cameraStream.getVideoTracks()[0];
  if (!track) return false;
  state.localStream?.addTrack(track);
  state.peerConnection.addTrack(track, state.localStream || cameraStream);
  useWebRTCStore.setState({ localStream: state.localStream || cameraStream, isVideoCall: true, isVideoOff: false });
  return true;
}

function createPeerConnection(targetUserId: string, callId: string, iceServers: any[]) {
  const pc: any = new RTCPeerConnection({ iceServers });
  pc.onicecandidate = ({ candidate }: any) => {
    if (!candidate) return;
    const state = useWebRTCStore.getState();
    if (!state.offerRegistered && state.callState !== 'ringing' && state.callState !== 'active') {
      useWebRTCStore.setState({ localIceQueue: [...state.localIceQueue, candidate] });
      return;
    }
    useSocketStore.getState().socket?.emit('ice-candidate', { callId, targetId: targetUserId, candidate });
  };
  pc.ontrack = ({ streams }: any) => {
    if (streams?.[0]) useWebRTCStore.getState().setRemoteStream(streams[0]);
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(pc.connectionState)) useWebRTCStore.getState().cleanupCall();
  };
  return pc;
}

async function createConnection(targetUserId: string, callId: string) {
  const response = await fetchJson<{ iceServers: any[] }>('/calls/ice-servers');
  const pc = createPeerConnection(targetUserId, callId, response.iceServers);
  useWebRTCStore.setState({ peerConnection: pc });
  return pc;
}

async function flushRemoteIce() {
  const state = useWebRTCStore.getState();
  if (!state.peerConnection?.remoteDescription) return;
  for (const candidate of state.remoteIceQueue) {
    await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
  }
  useWebRTCStore.setState({ remoteIceQueue: [] });
}

export const useWebRTCStore = create<WebRTCState>((set, get) => ({
  callState: 'idle',
  activeCallId: null,
  targetUserId: null,
  callerName: '',
  isVideoCall: false,
  isMuted: false,
  isVideoOff: false,
  videoUpgradePending: false,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  remoteIceQueue: [],
  localIceQueue: [],
  offerRegistered: false,
  setRemoteStream: (remoteStream) => set({ remoteStream }),

  setupSocketListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;
    get().removeSocketListeners();

    socket.on('call-offer', async (data: any) => {
      if (!data?.callId || !data?.callerId || !data?.offer?.sdp) return;
      if (get().callState !== 'idle') {
        socket.emit('call-rejected', { callId: data.callId, targetId: data.callerId, reason: 'busy' });
        return;
      }
      try {
        set({
          activeCallId: data.callId,
          targetUserId: data.callerId,
          callerName: data.callerName || 'Llamada entrante',
          isVideoCall: Boolean(data.isVideo),
          callState: 'ringing',
          offerRegistered: true,
        });
        const pc = await createConnection(data.callerId, data.callId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushRemoteIce();
        socket.emit('call-ringing', { callId: data.callId, targetId: data.callerId });
      } catch {
        get().cleanupCall();
      }
    });

    socket.on('call-ringing', ({ callId }: any) => {
      if (callId === get().activeCallId && get().callState === 'calling') set({ callState: 'ringback' });
    });

    socket.on('call-answer', async (data: any) => {
      const state = get();
      if (data?.callId !== state.activeCallId || !state.peerConnection || !data?.answer) return;
      await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flushRemoteIce();
      set({ callState: 'active' });
    });

    socket.on('ice-candidate', async (data: any) => {
      if (data?.callId !== get().activeCallId || !data?.candidate) return;
      const state = get();
      if (!state.peerConnection?.remoteDescription) {
        set({ remoteIceQueue: [...state.remoteIceQueue, data.candidate] });
      } else {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => undefined);
      }
    });

    socket.on('video-upgrade-request', ({ callId, requesterId }: any) => {
      if (callId !== get().activeCallId || get().callState !== 'active') return;
      Alert.alert('Cambiar a videollamada', 'La otra persona quiere activar video.', [
        { text: 'Rechazar', style: 'cancel', onPress: () => socket.emit('video-upgrade-response', { callId, targetId: requesterId, accepted: false }) },
        { text: 'Aceptar', onPress: async () => {
          try {
            await enableVideo();
            socket.emit('video-upgrade-response', { callId, targetId: requesterId, accepted: true });
          } catch {
            socket.emit('video-upgrade-response', { callId, targetId: requesterId, accepted: false });
            Alert.alert('Cámara no disponible', 'No fue posible activar la cámara.');
          }
        } },
      ]);
    });

    socket.on('video-upgrade-response', async ({ callId, responderId, accepted }: any) => {
      if (callId !== get().activeCallId) return;
      set({ videoUpgradePending: false });
      if (!accepted) return Alert.alert('Solicitud rechazada', 'La llamada continuará solo con audio.');
      try {
        await enableVideo();
        const pc = get().peerConnection;
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socket.emit('call-renegotiate-offer', { callId, targetId: responderId, offer });
      } catch {
        Alert.alert('Error', 'No se pudo cambiar a videollamada.');
      }
    });

    socket.on('call-renegotiate-offer', async ({ callId, senderId, offer }: any) => {
      const pc = get().peerConnection;
      if (callId !== get().activeCallId || !pc || !offer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushRemoteIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      set({ isVideoCall: true });
      socket.emit('call-renegotiate-answer', { callId, targetId: senderId, answer });
    });

    socket.on('call-renegotiate-answer', async ({ callId, answer }: any) => {
      const pc = get().peerConnection;
      if (callId !== get().activeCallId || !pc || !answer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushRemoteIce();
      set({ isVideoCall: true });
    });

    socket.on('call-ended', () => get().cleanupCall());
    socket.on('call-rejected', () => {
      get().cleanupCall();
      Alert.alert('Llamada finalizada', 'La llamada fue rechazada o finalizó.');
    });
  },

  removeSocketListeners: () => {
    const socket = useSocketStore.getState().socket;
    ['call-offer', 'call-ringing', 'call-answer', 'ice-candidate', 'video-upgrade-request',
      'video-upgrade-response', 'call-renegotiate-offer', 'call-renegotiate-answer',
      'call-ended', 'call-rejected'].forEach((event) => socket?.off(event));
  },

  startCall: async (targetUserId, targetUserName, video) => {
    if (get().callState !== 'idle') return;
    const callId = newCallId();
    set({
      callState: 'calling', activeCallId: callId, targetUserId, callerName: targetUserName,
      isVideoCall: video, offerRegistered: false, localIceQueue: [], remoteIceQueue: [],
    });
    try {
      const stream = await getLocalMedia(video);
      set({ localStream: stream });
      const pc = await createConnection(targetUserId, callId);
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      await fetchJson('/calls/offer', {
        method: 'POST',
        body: JSON.stringify({ callId, targetId: targetUserId, isVideo: video, offer }),
      });
      set({ offerRegistered: true });
      for (const candidate of get().localIceQueue) {
        useSocketStore.getState().socket?.emit('ice-candidate', { callId, targetId: targetUserId, candidate });
      }
      set({ localIceQueue: [] });
    } catch (error: any) {
      get().cleanupCall();
      Alert.alert('No se pudo llamar', error?.message || 'Revisa los permisos y la conexión.');
    }
  },

  acceptCall: async () => {
    const state = get();
    const socket = useSocketStore.getState().socket;
    if (!socket || !state.peerConnection || !state.targetUserId || !state.activeCallId) return;
    try {
      const stream = await getLocalMedia(state.isVideoCall);
      set({ localStream: stream });
      stream.getTracks().forEach((track: any) => state.peerConnection.addTrack(track, stream));
      const answer = await state.peerConnection.createAnswer();
      await state.peerConnection.setLocalDescription(answer);
      socket.emit('call-answer', { callId: state.activeCallId, targetId: state.targetUserId, answer });
      set({ callState: 'active' });
    } catch {
      get().rejectCall();
    }
  },

  rejectCall: () => {
    const state = get();
    if (state.activeCallId && state.targetUserId) {
      useSocketStore.getState().socket?.emit('call-rejected', { callId: state.activeCallId, targetId: state.targetUserId, reason: 'declined' });
    }
    get().cleanupCall();
  },

  endCall: () => {
    const state = get();
    if (state.activeCallId && state.targetUserId) {
      useSocketStore.getState().socket?.emit('call-ended', { callId: state.activeCallId, targetId: state.targetUserId, reason: 'completed' });
    }
    get().cleanupCall();
  },

  requestVideoUpgrade: () => {
    const state = get();
    if (state.isVideoCall || state.videoUpgradePending || !state.activeCallId || !state.targetUserId) return;
    useSocketStore.getState().socket?.emit('video-upgrade-request', { callId: state.activeCallId, targetId: state.targetUserId });
    set({ videoUpgradePending: true });
  },

  toggleMute: () => {
    const tracks = get().localStream?.getAudioTracks() || [];
    tracks.forEach((track: any) => { track.enabled = !track.enabled; });
    if (tracks[0]) set({ isMuted: !tracks[0].enabled });
  },

  toggleVideo: () => {
    const tracks = get().localStream?.getVideoTracks() || [];
    tracks.forEach((track: any) => { track.enabled = !track.enabled; });
    if (tracks[0]) set({ isVideoOff: !tracks[0].enabled });
  },

  cleanupCall: () => {
    const state = get();
    state.peerConnection?.close();
    state.localStream?.getTracks().forEach((track: any) => track.stop());
    set({
      callState: 'idle', activeCallId: null, targetUserId: null, callerName: '', isVideoCall: false,
      isMuted: false, isVideoOff: false, videoUpgradePending: false, localStream: null,
      remoteStream: null, peerConnection: null, remoteIceQueue: [], localIceQueue: [], offerRegistered: false,
    });
  },
}));
