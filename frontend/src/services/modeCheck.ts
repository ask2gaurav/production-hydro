import api from './api';
import { localDB } from '../db/localDB';
import { useStore } from '../store/useStore';

export async function checkModeOnBoot(machineId: string) {
  try {
    const response = await api.get(`/machines/${machineId}/mode-status`);
    const status = response.data;

    await localDB.settings.put({ machine_id: machineId, ...status });
    useStore.getState().setModeStatus(status);

  } catch (err) {
    const cached = await localDB.settings.get(machineId);
    if (cached) {
      useStore.getState().setModeStatus(cached);
    }
  }
}

export async function onSessionComplete(machineId: string) {
  try {
    const response = await api.get(`/machines/${machineId}/mode-status`);
    const status = response.data;
    await localDB.settings.put({ machine_id: machineId, ...status });
    useStore.getState().setModeStatus(status);
  } catch (err) {
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
}
