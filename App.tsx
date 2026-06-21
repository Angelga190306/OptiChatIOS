import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import ChatsTab from './src/screens/ChatsTab';
import StatusTab from './src/screens/StatusTab';
import CallsTab from './src/screens/CallsTab';
import SettingsTab from './src/screens/SettingsTab';
import ChatScreen from './src/screens/ChatScreen';
import ContactInfoScreen from './src/screens/ContactInfoScreen';

import { useAuthStore } from './src/store/useAuthStore';
import { useSocketStore } from './src/store/useSocketStore';
import { useWebRTCStore } from './src/store/useWebRTCStore';
import { ActiveCallView } from './src/components/chat/ActiveCallView';

export type RootStackParamList = {
  Login: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  Chat: { chatId: string; chatName: string; avatarUrl?: string };
  ContactInfo: { chatId: string; chatName: string; avatarUrl?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen 
        name="Chats" 
        component={ChatsTab} 
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>💬</Text> }}
      />
      <Tab.Screen 
        name="Novedades" 
        component={StatusTab} 
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔄</Text> }}
      />
      <Tab.Screen 
        name="Llamadas" 
        component={CallsTab} 
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📞</Text> }}
      />
      <Tab.Screen 
        name="Configuración" 
        component={SettingsTab} 
        options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text> }}
      />
    </Tab.Navigator>
  );
}

import { Text } from 'react-native';

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
        ) : !user.displayName ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen} 
              options={({ route }) => ({ title: route.params.chatName })} 
            />
            <Stack.Screen 
              name="ContactInfo" 
              component={ContactInfoScreen} 
              options={{ title: 'Info. del contacto' }} 
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
