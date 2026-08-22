import { registerPlugin } from '@capacitor/core';

export interface EspUsbPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeLine(options: { data: string }): Promise<void>;
  addListener(
    eventName: 'usbDeviceAttached',
    listenerFunc: (data: { vendorId: number; productId: number }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'usbConnected',
    listenerFunc: () => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'usbDisconnected',
    listenerFunc: (data: { reason: string }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'usbDataReceived',
    listenerFunc: (data: { line: string }) => void
  ): Promise<{ remove: () => void }>;
}

// No-op web implementation used during browser dev / PWA mode — there is no USB host
// bridge outside the native Android app.
const webImpl: EspUsbPlugin = {
  isAvailable: async () => ({ available: false }),
  connect: async () => {},
  disconnect: async () => {},
  writeLine: async () => {},
  addListener: async (_event: any, _handler: any) => ({ remove: () => {} }),
};

const EspUsb = registerPlugin<EspUsbPlugin>('EspUsb', {
  web: webImpl,
});

export { EspUsb };
