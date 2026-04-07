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
}));

window.addEventListener('online', () => useStore.getState().setOnline(true));
window.addEventListener('offline', () => useStore.getState().setOnline(false));
