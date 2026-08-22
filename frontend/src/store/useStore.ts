import { create } from 'zustand';
import type { MachineInfo } from '../services/esp32Service';

interface AppState {
  machineId: string;
  token: string;
  modeStatus: any;
  setModeStatus: (status: any) => void;
  setMachineId: (id: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
  online: boolean;
  setOnline: (status: boolean) => void;
  machineConnected: boolean;
  machineInfo: MachineInfo | null;
  setMachineConnected: (connected: boolean) => void;
  setMachineInfo: (info: MachineInfo | null) => void;
  // Informational only — which link last carried a successful ESP32 request/registration.
  // The actual per-call transport choice lives in usbTransport.ts, not this flag.
  activeTransport: 'usb' | 'wifi' | 'none';
  setActiveTransport: (transport: 'usb' | 'wifi' | 'none') => void;
  // User-selected transport preference (persisted in localDB.settings, loaded on boot).
  // 'auto' = today's prefer-USB-fall-back-to-WiFi behavior; 'wired'/'wifi' are hard
  // overrides enforced in transportSend() (nativeHttp.ts) — no fallback in either case.
  connectionMode: 'auto' | 'wired' | 'wifi';
  setConnectionMode: (mode: 'auto' | 'wired' | 'wifi') => void;
  // Set when a USB-sourced poll reports a machine_id different from modeStatus.serial_number
  // (only checked over USB — WiFi's hotspot SSID/password already gate this). Cleared on any
  // matching/WiFi poll. esp32Service.ts throws when this is set, so the app naturally falls
  // back to its normal disconnected-state handling; this flag only drives the explanatory modal.
  machineIdMismatch: { expected: string; actual: string } | null;
  setMachineIdMismatch: (mismatch: { expected: string; actual: string } | null) => void;
}

export const useStore = create<AppState>((set) => ({
  machineId: localStorage.getItem('machine_id') || '',
  token: localStorage.getItem('token') || '',
  modeStatus: {
    serial_number: '',
    mode: 'demo',
    is_locked: false,
    demo_sessions_used: 0,
    demo_session_limit: 10,
    sessions_remaining: 10,
    lock_screen_contact: null
  },
  setModeStatus: (status) => set({ modeStatus: status }),
  setMachineId: (id) => {
    localStorage.setItem('machine_id', id);
    set({ machineId: id });
  },
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('machine_id');
    localStorage.removeItem('token');
    set({ machineId: '', token: '' });
  },
  online: navigator.onLine,
  setOnline: (status) => set({ online: status }),
  machineConnected: false,
  machineInfo: null,
  setMachineConnected: (connected) => set({ machineConnected: connected }),
  setMachineInfo: (info) => set({ machineInfo: info }),
  activeTransport: 'none',
  setActiveTransport: (transport) => set({ activeTransport: transport }),
  connectionMode: 'auto',
  setConnectionMode: (mode) => set({ connectionMode: mode }),
  machineIdMismatch: null,
  setMachineIdMismatch: (mismatch) => set({ machineIdMismatch: mismatch }),
}));

window.addEventListener('online', () => useStore.getState().setOnline(true));
window.addEventListener('offline', () => useStore.getState().setOnline(false));
