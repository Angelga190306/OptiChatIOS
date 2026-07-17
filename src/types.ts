export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Tipos de las rutas del navegador de pila raíz. Se definen aquí (y App.tsx
 * los re-exporta) para que las pantallas puedan importarlos desde '../types'
 * sin generar imports circulares desde App.tsx.
 */
export type RootStackParamList = {
  Login: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  Chat: { chatId: string; chatName?: string; avatarUrl?: string; mediaToSend?: { uri: string; caption?: string; viewOnce: boolean; mime: string } };
  ContactInfo: { chatId: string; chatName: string; avatarUrl?: string };
  MultiMediaPicker: { chatId?: string };
  MultiMediaEditor: { assets: any[]; chatId?: string };
  CameraCapture: { chatId?: string };
};

export interface User {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  about: string | null;
  avatarUrl: string | null;
  localAvatarUri?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  backupFrequency?: 'Diaria' | 'Semanal' | 'Mensual' | 'Ninguna';
  blockedByMe?: boolean;
}

export interface Participant extends User { role: string; }

export interface Chat {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
  isGroup: boolean;
  isTyping: boolean;
  participants: Participant[];
  lastMessageSenderId: string | null;
  lastMessageStatus: string | null;
  lastMessageIsMine?: boolean | null;
}

export interface Message {
  _id: string;
  id?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaDuration?: number | null;
  localUri?: string | null;
  clientMessageId?: string | null;
  replyTo?: string | null;
  viewOnce?: boolean;
  viewOnceLimit?: number;
  viewOnceRemaining?: number;
  viewOnceOpened?: boolean;
  deletedForEveryone?: boolean;
  isStarred?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PendingMessage {
  clientMessageId: string;
  conversationId: string;
  kind: 'text' | 'media';
  content?: string;
  localUri?: string;
  fileName?: string;
  mimeType?: string;
  durationMs?: number;
  viewOnce?: boolean;
  viewOnceLimit?: number;
  createdAt: string;
}

export interface CallHistoryItem {
  id: string;
  conversationId: string | null;
  direction: 'OUTGOING' | 'INCOMING';
  type: 'AUDIO' | 'VIDEO';
  status: 'RINGING' | 'ANSWERED' | 'MISSED' | 'REJECTED' | 'CANCELED' | 'COMPLETED';
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  otherUser: User;
}

export interface BackupAttemptState {
  status: 'running' | 'success' | 'failed';
  trigger: 'manual' | 'startup' | 'scheduled';
  startedAt: string;
  completedAt?: string;
  lastBackup?: string;
  sizeInBytes?: number;
  formattedSize?: string;
  error?: string;
}

export interface BackupInfo {
  available: boolean;
  frequency: string;
  lastBackup: string | null;
  size: number;
  formattedSize: string;
  conversations: number;
  messages: number;
  mediaFiles: number;
  statuses: number;
  warnings: number;
  timezone: string;
  automaticBackupHour: number;
  lastAttempt: BackupAttemptState | null;
}
