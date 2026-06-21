import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';

import { useAuthStore } from './src/store/useAuthStore';
import { useSocketStore } from './src/store/useSocketStore';
import { useWebRTCStore } from './src/store/useWebRTCStore';
import { ActiveCallView } from './src/components/chat/ActiveCallView';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Chat: { chatId: string; chatName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const { user, accessToken } = useAuthStore();
  const { connect, disconnect } = useSocketStore();
  
  const {
    callState,
    callerName,
    isVideoCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setupSocketListeners,
    removeSocketListeners
  } = useWebRTCStore();

  useEffect(() => {
    if (user && accessToken) {
      connect();
      // Pequeño delay para asegurar que el socket está conectado antes de configurar listeners
      setTimeout(() => {
        setupSocketListeners();
      }, 500);
    } else {
      removeSocketListeners();
      disconnect();
    }
    return () => removeSocketListeners();
  }, [user, accessToken]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" />
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0066cc' }, headerTintColor: '#fff' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'OptiChat' }} />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen} 
              options={({ route }) => ({ title: route.params.chatName })} 
            />
          </>
        )}
      </Stack.Navigator>
      
      {user && callState !== 'idle' && (
        <ActiveCallView
          callState={callState}
          callerName={callerName}
          isVideoCall={isVideoCall}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
        />
      )}
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
