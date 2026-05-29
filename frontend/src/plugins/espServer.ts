import { registerPlugin } from '@capacitor/core';

export interface EspServerPlugin {
  startServer(): Promise<{ port: number }>;
  stopServer(): Promise<void>;
  addListener(
    eventName: 'espRegistered',
    listenerFunc: (data: { ip: string; serial: string }) => void
  ): Promise<{ remove: () => void }>;
}

// No-op web implementation used during browser dev / PWA mode
const webImpl: EspServerPlugin = {
  startServer: async () => ({ port: 8765 }),
  stopServer: async () => {},
  addListener: async (_event, _handler) => ({ remove: () => {} }),
};

const EspServer = registerPlugin<EspServerPlugin>('EspServer', {
  web: webImpl,
});

export { EspServer };
