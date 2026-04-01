import { create } from 'zustand';

interface AppState {
  machineId: string;
  modeStatus: any;
  setModeStatus: (status: any) => void;
  online: boolean;
  setOnline: (status: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  machineId: import.meta.env.VITE_MACHINE_ID || 'MACHINE_001', 
  modeStatus: {
    mode: 'demo',
    is_locked: false,
    demo_sessions_used: 0,
    demo_session_limit: 10,
    sessions_remaining: 10,
    lock_screen_contact: null
  },
  setModeStatus: (status) => set({ modeStatus: status }),
  online: navigator.onLine,
  setOnline: (status) => set({ online: status })
}));

window.addEventListener('online', () => useStore.getState().setOnline(true));
window.addEventListener('offline', () => useStore.getState().setOnline(false));
