import messaging from '@react-native-firebase/messaging';
import { getApiUrl } from './api';

/**
 * Servicio para la gestión de Notificaciones Push (FCM) en iOS.
 * NOTA: Requiere que el archivo GoogleService-Info.plist esté configurado en Xcode.
 */
export const PushNotificationService = {
  /**
   * Solicita permisos al usuario y configura el token de FCM.
   */
  async init() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('Push notifications permission not granted');
        return null;
      }

      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return null;
    }
  },

  /**
   * Envía el token de FCM al backend para registrar el dispositivo.
   */
  async updateTokenOnBackend(token: string, accessToken: string) {
    try {
      await fetch(`${getApiUrl('/users/fcm-token')}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });
    } catch (error) {
      console.error('Error updating FCM token on backend:', error);
    }
  },

  /**
   * Configura el listener para mensajes recibidos en primer plano.
   */
  setupForegroundListener(onMessageReceived: (remoteMessage: any) => void) {
    return messaging().onMessage(async remoteMessage => {
      console.log('Foreground message received:', remoteMessage);
      onMessageReceived(remoteMessage);
    });
  },

  /**
   * Maneja el evento de apertura de la app mediante una notificación.
   */
  async handleInitialNotification() {
    const remoteMessage = await messaging().getInitialNotification();
    return remoteMessage;
  },
};
