import { registerPlugin } from '@capacitor/core';

export interface BackupFolderPlugin {
  /** Opens Android's Storage Access Framework folder picker. */
  pickFolder(): Promise<{ uri: string; name: string }>;
  /** Checks whether the app still holds a persisted write grant for this folder URI. */
  isAccessible(options: { uri: string }): Promise<{ accessible: boolean }>;
  /** Writes (overwriting any existing file of the same name) into the chosen folder. */
  writeFile(options: { uri: string; fileName: string; data: string; mimeType?: string }): Promise<void>;
}

// No-op web implementation used during browser dev / PWA mode — SAF is Android-only.
const webImpl: BackupFolderPlugin = {
  pickFolder: async () => {
    throw new Error('Choosing a backup folder is only available on the native app.');
  },
  isAccessible: async () => ({ accessible: false }),
  writeFile: async () => {
    throw new Error('Writing to a backup folder is only available on the native app.');
  },
};

const BackupFolder = registerPlugin<BackupFolderPlugin>('BackupFolder', {
  web: webImpl,
});

export { BackupFolder };
