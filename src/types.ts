export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

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
}
