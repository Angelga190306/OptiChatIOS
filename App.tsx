import React, { Component, ReactNode, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  AppState,
  StatusBar,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
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
import { useChatStore } from './src/store/useChatStore';
import { useWebRTCStore } from './src/store/useWebRTCStore';
import { ActiveCallView } from './src/components/chat/ActiveCallView';
import { fetchJson } from './src/lib/api';
import { cacheOwnAvatar } from './src/lib/offlineFiles';
import { User } from './src/types';

export type RootStackParamList = {
  Login: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  Chat: { chatId: string; chatName: string; avatarUrl?: string };
  ContactInfo: { chatId: string; chatName: string; avatarUrl?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            padding: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#b3261e' }}>
            OptiChat encontró un error
          </Text>
          <Text style={{ marginTop: 12, color: '#555', textAlign: 'center' }}>
            {this.state.error.message}
          </Text>
          <Text style={{ marginTop: 12, color: '#777', textAlign: 'center' }}>
            La aplicación seguirá abierta para poder identificarlo.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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

function App() {
  const { user, accessToken, hasHydrated, updateUser } = useAuthStore();
  const { connect, disconnect, reconnectForNetwork, socket } = useSocketStore();

  const {
    callState,
    callerName,
    isVideoCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    videoUpgradePending,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    requestVideoUpgrade,
    setupSocketListeners,
    removeSocketListeners,
  } = useWebRTCStore();

  useEffect(() => {
    if (user && accessToken) {
      connect();
    } else {
      removeSocketListeners();
      disconnect();
    }
    return () => removeSocketListeners();
  }, [user?.id, accessToken]);

  useEffect(() => {
    if (!socket) return;
    setupSocketListeners();
    return () => removeSocketListeners();
  }, [socket]);

  useEffect(() => {
    const refresh = async () => {
      if (!useAuthStore.getState().accessToken) return;
      try {
        const profile = await fetchJson<User>('/users/me');
        const localAvatarUri = await cacheOwnAvatar(profile.avatarUrl);
        updateUser({
          ...profile,
          localAvatarUri: localAvatarUri || user?.localAvatarUri,
        });
      } catch {
        // La sesión y la foto local siguen disponibles sin red.
      }
    };
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      useChatStore.getState().setOnline(online);
      if (online && useAuthStore.getState().accessToken) {
        reconnectForNetwork();
        void useChatStore.getState().flushOutbox();
        void refresh();
      }
    });
    const appSubscription = AppState.addEventListener('change', state => {
      if (state === 'active' && useAuthStore.getState().accessToken) {
        reconnectForNetwork();
        void useChatStore.getState().flushOutbox();
        void refresh();
      }
    });
    void refresh();
    return () => {
      unsubscribeNetwork();
      appSubscription.remove();
    };
  }, [user?.id]);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: '#0066cc' },
              headerTintColor: '#fff',
            }}
          >
            {!user ? (
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
            ) : !user.displayName ? (
              <Stack.Screen
                name="ProfileSetup"
                component={ProfileSetupScreen}
                options={{ headerShown: false }}
              />
            ) : (
              <>
                <Stack.Screen
                  name="MainTabs"
                  component={MainTabs}
                  options={{ headerShown: false }}
                />
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
              videoUpgradePending={videoUpgradePending}
              onAccept={acceptCall}
              onReject={rejectCall}
              onEnd={endCall}
              onToggleMute={toggleMute}
              onToggleVideo={toggleVideo}
              onRequestVideoUpgrade={requestVideoUpgrade}
            />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

export default App;
