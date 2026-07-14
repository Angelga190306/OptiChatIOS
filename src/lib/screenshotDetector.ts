import { NativeEventEmitter, NativeModules } from 'react-native';

const { ScreenshotDetector } = NativeModules;

let screenshotListener: NativeEventEmitter | null = null;
if (ScreenshotDetector) {
  screenshotListener = new NativeEventEmitter(ScreenshotDetector);
}

/**
 * Suscribe una función al evento de captura de pantalla.
 * @param callback Función a ejecutar cuando se detecta la captura.
 * @returns Una función para cancelar la suscripción.
 */
export const subscribeToScreenshots = (callback: (event: any) => void) => {
  if (!screenshotListener) {
    console.warn('ScreenshotDetector native module not found');
    return () => {};
  }
  return screenshotListener.addListener('onScreenshotTaken', callback);
};
