import api from './api';
import { localDB } from '../db/localDB';
import { useStore } from '../store/useStore';

export async function checkModeOnBoot(machineId: string) {
  try {
    const response = await api.get(`/machines/${machineId}/mode-status`);
    const status = response.data;

    console.log('[modeCheck] server status:', status);
    const existing = await localDB.settings.get(machineId);
    await localDB.settings.put({ ...existing, machine_id: machineId, ...status });
    useStore.getState().setModeStatus(status);

  } catch (err) {
    const cached = await localDB.settings.get(machineId);
    if (cached) {
      useStore.getState().setModeStatus(cached);
    }
  }
}

export async function onSessionComplete(machineId: string) {
  if (navigator.onLine) {
    // Session was already pushed by runSync before this call — fetch authoritative status
    try {
      const response = await api.get(`/machines/${machineId}/mode-status`);
      const status = response.data;
      const existing = await localDB.settings.get(machineId);
      await localDB.settings.put({ ...existing, machine_id: machineId, ...status });
      useStore.getState().setModeStatus(status);
      return;
    } catch {
      // Fall through to offline path if the request fails despite being "online"
    }
  }

  // Offline path: increment session count locally
  const cached = await localDB.settings.get(machineId);
  if (cached && cached.mode === 'demo' && typeof cached.demo_sessions_used === 'number') {
    cached.demo_sessions_used += 1;
    if (cached.demo_session_limit && cached.demo_sessions_used >= cached.demo_session_limit) {
      cached.is_locked = true;
    }
    cached.sessions_remaining = cached.demo_session_limit ? Math.max(0, cached.demo_session_limit - cached.demo_sessions_used) : 0;
    await localDB.settings.put(cached);
    useStore.getState().setModeStatus(cached);
  }
}
