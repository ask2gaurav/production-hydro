import Dexie, { type Table } from 'dexie';

export interface LocalSession {
  id?: number;
  machine_id: string;
  therapist_id?: string;
  patient_id?: string;
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  water_temp_log: any[];
  water_level_log: any[];
  session_note?: string;
  status: string;
  synced: number;
  created_at: Date;
}

export interface LocalSettings {
  machine_id: string;
  default_session_minutes?: number;
  max_temperature?: number;
  default_temperature?: number;
  water_inlet_valve?: boolean;
  flush_valve?: boolean;
  blower_switch?: boolean;
  heater_switch?: boolean;

  // Demo Mode overrides
  mode?: string;
  demo_sessions_used?: number;
  demo_session_limit?: number;
  sessions_remaining?: number | null;
  is_locked?: boolean;
  lock_screen_contact?: any;
}

export interface LocalTherapist {
  id?: number;
  server_id?: string;      // MongoDB _id once synced
  machine_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  synced: number;
}

export interface LocalPatient {
  id?: number;
  server_id?: string;      // MongoDB _id once synced
  machine_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  dob?: string;
  notes?: string;
  is_active: boolean;
  synced: number;
}

export class HydroDb extends Dexie {
  sessions!: Table<LocalSession, number>;
  therapists!: Table<LocalTherapist, number>;
  patients!: Table<LocalPatient, number>;
  settings!: Table<LocalSettings, string>;

  constructor() {
    super('HydrotherapyDB');
    this.version(1).stores({
      sessions: '++id, machine_id, synced, created_at',
      therapists: '++id, machine_id',
      patients: '++id, machine_id',
      settings: 'machine_id'
    });
    // Version 2: add synced + server_id indexes to therapists and patients
    this.version(2).stores({
      sessions: '++id, machine_id, synced, created_at',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id'
    });
  }
}

export const localDB = new HydroDb();
