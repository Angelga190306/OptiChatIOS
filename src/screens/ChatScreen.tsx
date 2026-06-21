import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { useWebRTCStore } from '../store/useWebRTCStore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import Video from 'react-native-video';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const { chatId, chatName } = route.params;
  const { messages, isLoadingMessages, loadMessages, sendMessage, chats } = useChatStore();
  const { user, accessToken } = useAuthStore();
  const { startCall } = useWebRTCStore();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const currentChat = chats.find(c => c.id === chatId);
  // Find the other participant to call them
  const targetUser = currentChat?.participants.find(p => p.id !== user?.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={() => handleStartCall(false)}>
            <Icon name="call" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleStartCall(true)}>
            <Icon name="videocam" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, currentChat]);

  const handleStartCall = (isVideo: boolean) => {
    if (targetUser) {
      startCall(targetUser.id, targetUser.displayName || targetUser.phoneNumber, isVideo);
    }
  };

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId]);

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(chatId, text.trim());
      setText('');
    }
  };

  const handleSendVoice = async (fileUri: string) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: 'voice-note.m4a',
        type: 'audio/mp4',
      } as any);

      const res = await fetch(`https://optichat.optishieldx.com/api/chats/${chatId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
    } catch (err) {
      console.error("Audio upload error", err);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.id;
    
    // Si es viewOnce y no soy yo quien lo mandó, mostrar un placeholder o el contenido si no se ha visto
    // Para simplificar, si es viewOnce, solo mostramos un botón de "Foto (1)"
    if (item.viewOnce) {
      return (
        <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageThem]}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 5 }}>
            <Icon name={item.type === 'VIDEO' ? 'videocam' : item.type === 'AUDIO' ? 'mic' : 'image'} size={24} color="#0066cc" />
            <Text style={[styles.messageText, { fontStyle: 'italic', marginLeft: 8, color: '#0066cc' }]}>
              {item.type === 'AUDIO' ? 'Mensaje de voz' : item.type === 'VIDEO' ? 'Video' : 'Foto'} (Ver una sola vez)
            </Text>
          </TouchableOpacity>
          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            {isMe && <Text style={{ color: item.read ? '#34B7F1' : '#888' }}> ✓✓</Text>}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageThem]}>
        {item.type === 'AUDIO' ? (
          <Video 
            source={{ uri: item.mediaUrl }}
            controls
            style={{ width: 200, height: 40 }}
            paused
          />
        ) : item.type === 'IMAGE' ? (
          <Image
            source={{ uri: item.mediaUrl }}
            style={{ width: 200, height: 200, borderRadius: 8 }}
          />
        ) : item.type === 'VIDEO' ? (
          <Video
            source={{ uri: item.mediaUrl }}
            controls
            style={{ width: 200, height: 200, borderRadius: 8 }}
            paused
          />
        ) : (
          <Text style={styles.messageText}>{item.content}</Text>
        )}
        <Text style={styles.timeText}>
          {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          {isMe && <Text style={{ color: item.read ? '#34B7F1' : '#888' }}> ✓✓</Text>}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoadingMessages && messages.length === 0 ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0066cc" />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item: any) => item._id || item.id || Math.random().toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted={false} // Depending on how messages are sorted, usually we'd invert it but let's just show them in order
        />
      )}
      
      <View style={styles.inputContainer}>
        {isRecording ? (
          <VoiceRecorder 
            onCancel={() => setIsRecording(false)} 
            onSend={(uri) => {
              setIsRecording(false);
              handleSendVoice(uri);
            }} 
          />
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#999"
              value={text}
              onChangeText={setText}
              multiline
            />
            {text.trim() ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                <Icon name="send" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.sendButton} onPress={() => setIsRecording(true)}>
                <Icon name="mic" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  messageList: {
    padding: 15,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
    borderBottomRightRadius: 0,
  },
  messageThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  timeText: {
    fontSize: 10,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 40,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    marginLeft: 10,
    marginBottom: 5,
    backgroundColor: '#0066cc',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
