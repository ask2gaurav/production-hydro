import api from './api';
import { localDB, type LocalResource } from '../db/localDB';

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

// Push any unsynced sessions to the server.
// Must be called AFTER syncPendingTherapists and syncPendingPatients so that
// server_ids are available for the foreign key references.
export async function syncPendingSessions(machineId: string): Promise<void> {
  const unsynced = await localDB.sessions
    .where('synced').equals(0)
    .and((s) => s.machine_id === machineId)
    .toArray();

  for (const session of unsynced) {
    try {
      // Resolve therapist server_id
      let therapist_server_id: string | undefined;
      if (session.therapist_id) {
        const localId = parseInt(session.therapist_id, 10);
        const therapist = isNaN(localId)
          ? await localDB.therapists.where('server_id').equals(session.therapist_id).first()
          : await localDB.therapists.get(localId);
        if (!therapist?.server_id) continue; // therapist not synced yet — skip this session
        therapist_server_id = therapist.server_id;
      }

      // Resolve patient server_id
      let patient_server_id: string | undefined;
      if (session.patient_id) {
        const localId = parseInt(session.patient_id, 10);
        const patient = isNaN(localId)
          ? await localDB.patients.where('server_id').equals(session.patient_id).first()
          : await localDB.patients.get(localId);
        if (!patient?.server_id) continue; // patient not synced yet — skip this session
        patient_server_id = patient.server_id;
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

      await localDB.sessions.update(session.id!, { synced: 1 });
    } catch {
      // Will retry next time sync runs
    }
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

// Run full sync: therapists/patients first, then sessions, then pull latest
export async function runSync(machineId: string): Promise<void> {
  if (!machineId || !navigator.onLine) return;
  await syncPendingTherapists(machineId);
  await syncPendingPatients(machineId);
  await syncPendingSessions(machineId);
  await fetchAndCacheTherapists(machineId);
  await fetchAndCachePatients(machineId);
}
