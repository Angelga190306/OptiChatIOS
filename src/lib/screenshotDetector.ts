import { NativeEventEmitter, NativeModules } from 'react-native';

const { ScreenshotDetector } = NativeModules;

export const screenshotListener = new NativeEventEmitter(ScreenshotDetector);

/**
 * Suscribe una función al evento de captura de pantalla.
 * @param callback Función a ejecutar cuando se detecta la captura.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToScreenshots = (callback: (event: any) => void) => {
  if (!ScreenshotDetector) {
    console.warn('ScreenshotDetector native module not found');
    return () => {};
  }
  return screenshotListener.addListener('onScreenshotTaken', callback);
};
