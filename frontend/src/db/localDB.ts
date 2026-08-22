import Dexie, { type Table } from 'dexie';

export interface LocalSession {
  id?: number;
  server_id?: string;       // MongoDB _id once synced
  machine_id: string;
  therapist_id?: string;         // local Dexie numeric id (as string) for local lookups
  patient_id?: string;           // local Dexie numeric id (as string) for local lookups
  therapist_server_id?: string;  // MongoDB ObjectId of therapist
  patient_server_id?: string;    // MongoDB ObjectId of patient
  start_time: Date;
  end_time?: Date;
  duration_minutes: number;
  water_temp_log: number[];
  water_level_log: number[];
  session_note?: string;
  status: string;
  synced: number;
  created_at: Date;
}

export interface LocalSettings {
  machine_id: string;
  default_session_minutes?: number;
  max_temperature?: number;
  therapy_min_temp?: number;
  default_temperature?: number;
  water_inlet_valve?: boolean;
  flush_valve?: boolean;
  blower_switch?: boolean;
  heater_switch?: boolean;
  pump_switch?: boolean;
  flush_frequency?: number;
  auto_flush?: boolean;
  flush_duration?: number;
  flush_mode?: 'continuous' | 'interval';
  blower_auto?: boolean;
  blower_frequency_mode?: 'continuous' | 'interval';
  blower_interval?: number;
  blower_duration?: number;

  // WiFi credentials synced from server
  ssid?: string;
  password?: string;

  // Demo Mode overrides
  mode?: string;
  demo_sessions_used?: number;
  demo_session_limit?: number;
  sessions_remaining?: number | null;
  is_locked?: boolean;
  lock_screen_contact?: Record<string, string>;

  // Next therapy reminder settings
  next_therapy_reminder_days?: number;
  next_therapy_alert_lead_days?: number;
  next_therapy_reminder_message_en?: string;
  next_therapy_reminder_message_gu?: string;
  next_therapy_reminder_message_hi?: string;

  // Auto Backup
  auto_backup_enabled?: boolean;
  auto_backup_retention_count?: number;
  // Regenerated on every login — folded into the auto-backup filename so a fresh
  // install/login never collides with a same-named file an old install left behind
  // (e.g. an orphaned public-storage file the new install can't delete or overwrite).
  auto_backup_install_id?: string;

  // ESP32 connection transport preference — 'auto' (default) prefers USB, falls back to
  // WiFi; 'wired'/'wifi' are hard overrides with no automatic fallback to the other.
  connection_mode?: 'auto' | 'wired' | 'wifi';
}

export interface LocalTherapist {
  id?: number;
  server_id?: string;      // MongoDB _id once synced
  machine_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  gender?: string;
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
  gender?: string;
  dob?: string;
  notes?: string;
  is_active: boolean;
  synced: number;

  // Next therapy reminder overrides
  reminder_days_override?: number;
  alert_lead_days_override?: number;
  last_reminded_at?: string;
  next_therapy_date_override?: string; // ISO date (YYYY-MM-DD) — explicit reschedule, takes priority over the computed due date
}

export interface LocalReminderLog {
  id?: number;
  machine_id: string;
  patient_id?: number;        // local Dexie id
  patient_server_id?: string; // mongo id, mirrors LocalPatient.server_id
  method: 'sms' | 'whatsapp' | 'email' | 'call';
  language?: 'en' | 'gu' | 'hi';
  message?: string;           // empty/undefined for 'call'
  sent_at: string;            // ISO string
}

export interface LocalResource {
  id?: number;
  server_id: string;       // MongoDB _id
  machine_id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  is_active: boolean;
}

export class HydroDb extends Dexie {
  sessions!: Table<LocalSession, number>;
  therapists!: Table<LocalTherapist, number>;
  patients!: Table<LocalPatient, number>;
  settings!: Table<LocalSettings, string>;
  resources!: Table<LocalResource, number>;
  reminder_logs!: Table<LocalReminderLog, number>;

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
    // Version 3: add resources table
    this.version(3).stores({
      sessions: '++id, machine_id, synced, created_at',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id',
      resources: '++id, machine_id, server_id',
    });
    // Version 4: add server_id index to sessions
    this.version(4).stores({
      sessions: '++id, machine_id, synced, created_at, server_id',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id',
      resources: '++id, machine_id, server_id',
    });
    // Version 5: add therapist_server_id and patient_server_id indexes to sessions
    this.version(5).stores({
      sessions: '++id, machine_id, synced, created_at, server_id, therapist_server_id, patient_server_id',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id',
      resources: '++id, machine_id, server_id',
    });
    // Version 6: add next-therapy reminder fields (settings + patients) — no new indexes
    this.version(6).stores({
      sessions: '++id, machine_id, synced, created_at, server_id, therapist_server_id, patient_server_id',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id',
      resources: '++id, machine_id, server_id',
    });
    // Version 7: add reminder_logs table
    this.version(7).stores({
      sessions: '++id, machine_id, synced, created_at, server_id, therapist_server_id, patient_server_id',
      therapists: '++id, machine_id, synced, server_id',
      patients: '++id, machine_id, synced, server_id',
      settings: 'machine_id',
      resources: '++id, machine_id, server_id',
      reminder_logs: '++id, machine_id, patient_id, patient_server_id, sent_at',
    });
  }
}

export const localDB = new HydroDb();
