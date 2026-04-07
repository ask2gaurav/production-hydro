import api from './api';
import { localDB, type LocalResource } from '../db/localDB';
import { checkModeOnBoot } from './modeCheck';

// Pull therapists from server and upsert into local DB
export async function fetchAndCacheTherapists(machineId: string): Promise<void> {
  try {
    const res = await api.get(`/therapists?machine_id=${machineId}`);
    const serverList: any[] = res.data;

    for (const s of serverList) {
      const existing = await localDB.therapists
        .where('server_id').equals(s._id).first();

      if (existing) {
        await localDB.therapists.update(existing.id!, {
          first_name: s.first_name,
          last_name: s.last_name,
          phone: s.phone,
          email: s.email,
          is_active: s.is_active,
          synced: 1,
        });
      } else {
        await localDB.therapists.add({
          server_id: s._id,
          machine_id: machineId,
          first_name: s.first_name,
          last_name: s.last_name,
          phone: s.phone ?? '',
          email: s.email ?? '',
          is_active: s.is_active ?? true,
          synced: 1,
        });
      }
    }
  } catch {
    // Offline or server error — silently continue with local data
  }
}

// Pull patients from server and upsert into local DB
export async function fetchAndCachePatients(machineId: string): Promise<void> {
  try {
    const res = await api.get(`/patients?machine_id=${machineId}`);
    const serverList: any[] = res.data;

    for (const s of serverList) {
      const existing = await localDB.patients
        .where('server_id').equals(s._id).first();

      if (existing) {
        await localDB.patients.update(existing.id!, {
          first_name: s.first_name,
          last_name: s.last_name,
          phone: s.phone,
          email: s.email,
          dob: s.dob,
          notes: s.notes,
          is_active: s.is_active,
          synced: 1,
        });
      } else {
        await localDB.patients.add({
          server_id: s._id,
          machine_id: machineId,
          first_name: s.first_name,
          last_name: s.last_name,
          phone: s.phone ?? '',
          email: s.email ?? '',
          dob: s.dob ?? '',
          notes: s.notes ?? '',
          is_active: s.is_active ?? true,
          synced: 1,
        });
      }
    }
  } catch {
    // Offline or server error — silently continue with local data
  }
}

// Push any unsynced therapists to the server
export async function syncPendingTherapists(machineId: string): Promise<void> {
  const unsynced = await localDB.therapists
    .where('synced').equals(0)
    .and((t) => t.machine_id === machineId)
    .toArray();
  for (const therapist of unsynced) {
    try {
      const res = await api.post('/therapists', {
        machine_id: machineId,
        first_name: therapist.first_name,
        last_name: therapist.last_name,
        phone: therapist.phone,
        email: therapist.email,
      });
      await localDB.therapists.update(therapist.id!, {
        server_id: res.data._id,
        synced: 1,
      });
    } catch {
      // Will retry next time sync runs
    }
  }
}

// Push any unsynced patients to the server
export async function syncPendingPatients(machineId: string): Promise<void> {
  const unsynced = await localDB.patients
    .where('synced').equals(0)
    .and((p) => p.machine_id === machineId)
    .toArray();

  for (const patient of unsynced) {
    try {
      const res = await api.post('/patients', {
        machine_id: machineId,
        first_name: patient.first_name,
        last_name: patient.last_name,
        phone: patient.phone,
        email: patient.email,
        dob: patient.dob,
        notes: patient.notes,
      });
      await localDB.patients.update(patient.id!, {
        server_id: res.data._id,
        synced: 1,
      });
    } catch {
      // Will retry next time sync runs
    }
  }
}

// Push any unsynced completed sessions to the server.
// Must be called AFTER syncPendingTherapists and syncPendingPatients so that
// server_ids are available for the foreign key references.
// Active sessions are skipped — they are only synced once completed.
export async function syncPendingSessions(machineId: string): Promise<void> {
  const unsynced = await localDB.sessions
    .where('synced').equals(0)
    .and((s) => s.machine_id === machineId && s.status !== 'active')
    .toArray();

  for (const session of unsynced) {
    try {
      // Resolve therapist server_id — prefer dedicated field, fall back to local DB lookup
      let therapist_server_id: string | undefined = session.therapist_server_id;
      if (!therapist_server_id && session.therapist_id) {
        const localId = parseInt(session.therapist_id, 10);
        if (!isNaN(localId)) {
          const therapist = await localDB.therapists.get(localId);
          if (!therapist?.server_id) {
            console.warn('[sync] skipping session', session.id, '— therapist not synced yet, local id:', localId);
            continue;
          }
          therapist_server_id = therapist.server_id;
        }
      }

      // Resolve patient server_id — prefer dedicated field, fall back to local DB lookup
      let patient_server_id: string | undefined = session.patient_server_id;
      if (!patient_server_id && session.patient_id) {
        const localId = parseInt(session.patient_id, 10);
        if (!isNaN(localId)) {
          const patient = await localDB.patients.get(localId);
          if (!patient?.server_id) {
            console.warn('[sync] skipping session', session.id, '— patient not synced yet, local id:', localId);
            continue;
          }
          patient_server_id = patient.server_id;
        }
      }

      if (session.server_id) {
        // Already on the server (e.g. legacy active-session push) — just mark synced locally
        await localDB.sessions.update(session.id!, { synced: 1 });
        continue;
      }

      const res = await api.post('/sessions', {
        machine_id: machineId,
        therapist_id: therapist_server_id,
        patient_id: patient_server_id,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.duration_minutes,
        session_note: session.session_note,
        status: session.status,
        water_temp_log: session.water_temp_log,
        water_level_log: session.water_level_log,
      });

      // Server wraps response as { session, demo_locked }
      const serverId: string = res.data?.session?._id ?? res.data?._id;
      await localDB.sessions.update(session.id!, { server_id: serverId, synced: 1 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[syncPendingSessions] Failed to sync session id', session.id, '—', msg);
      // Will retry next time sync runs
    }
  }
}

interface ServerSession {
  _id: string;
  machine_id: string;
  therapist_id?: string;
  patient_id?: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  water_temp_log: number[];
  water_level_log: number[];
  session_note?: string;
  status: string;
}

// Pull sessions from server and upsert into local DB
export async function fetchAndCacheSessions(machineId: string): Promise<void> {
  try {
    const res = await api.get(`/sessions?machine_id=${machineId}`);
    const serverList: ServerSession[] = res.data;

    for (const s of serverList) {
      const existing = await localDB.sessions
        .where('server_id').equals(s._id).first();

      if (existing) {
        await localDB.sessions.update(existing.id!, {
          end_time: s.end_time ? new Date(s.end_time) : undefined,
          duration_minutes: s.duration_minutes,
          session_note: s.session_note ?? '',
          status: s.status,
          synced: 1,
        });
      } else {
        // therapist_id/patient_id may be populated objects from the server — extract _id string
        const therapistServerId = s.therapist_id
          ? (typeof s.therapist_id === 'object' ? (s.therapist_id as { _id: string })._id : s.therapist_id)
          : undefined;
        const patientServerId = s.patient_id
          ? (typeof s.patient_id === 'object' ? (s.patient_id as { _id: string })._id : s.patient_id)
          : undefined;
        await localDB.sessions.add({
          server_id: s._id,
          machine_id: machineId,
          therapist_server_id: therapistServerId,
          patient_server_id: patientServerId,
          start_time: new Date(s.start_time),
          end_time: s.end_time ? new Date(s.end_time) : undefined,
          duration_minutes: s.duration_minutes ?? 0,
          water_temp_log: s.water_temp_log ?? [],
          water_level_log: s.water_level_log ?? [],
          session_note: s.session_note ?? '',
          status: s.status ?? 'completed',
          synced: 1,
          created_at: new Date(s.start_time),
        });
      }
    }
  } catch {
    // Offline or server error — silently continue with local data
  }
}

// Pull resources from server and upsert into local DB
export async function fetchAndCacheResources(machineId: string): Promise<void> {
  try {
    const res = await api.get(`/resources?machine_id=${machineId}`);
    type ServerResource = Omit<LocalResource, 'id' | 'server_id'> & { _id: string };
    const serverList: ServerResource[] = res.data;

    for (const s of serverList) {
      const existing = await localDB.resources
        .where('server_id').equals(s._id).first();

      if (existing) {
        await localDB.resources.update(existing.id!, {
          title: s.title,
          slug: s.slug,
          content: s.content,
          category: s.category,
          is_active: s.is_active,
        });
      } else {
        await localDB.resources.add({
          server_id: s._id,
          machine_id: machineId,
          title: s.title,
          slug: s.slug ?? '',
          content: s.content ?? '',
          category: s.category ?? '',
          is_active: s.is_active ?? true,
        });
      }
    }
  } catch {
    // Offline or server error — silently continue with local data
  }
}

// Run full sync: push pending data first, pull latest, then refresh mode status.
// Mode status must be fetched LAST so the server has accurate session counts before
// we evaluate is_locked — prevents stale "not locked" responses unlocking the app.
export async function runSync(machineId: string): Promise<void> {
  if (!machineId || !navigator.onLine) return;
  await syncPendingTherapists(machineId);
  await syncPendingPatients(machineId);
  await syncPendingSessions(machineId);
  await fetchAndCacheTherapists(machineId);
  await fetchAndCachePatients(machineId);
  await fetchAndCacheSessions(machineId);
  await checkModeOnBoot(machineId);
}
