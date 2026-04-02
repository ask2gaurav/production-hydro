import { create } from 'zustand';

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
}

export const useStore = create<AppState>((set) => ({
  machineId: localStorage.getItem('machine_id') || '',
  token: localStorage.getItem('token') || '',
  modeStatus: {
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
  setOnline: (status) => set({ online: status })
}));

window.addEventListener('online', () => useStore.getState().setOnline(true));
window.addEventListener('offline', () => useStore.getState().setOnline(false));
