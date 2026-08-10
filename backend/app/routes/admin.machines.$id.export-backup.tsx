import JSZip from "jszip";
import { requireAdmin } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";
import Patient from "../models/Patient";
import Therapist from "../models/Therapist";
import Session from "../models/Session";
import Settings from "../models/Settings";

const BACKUP_SCHEMA_VERSION = 1;

// Resource route (no default export) — GET returns a zip file matching the shape the
// Android app's Import Backup feature expects (frontend/src/services/backupService.ts).
export async function loader({ request, params }: { request: Request; params: any }) {
  await requireAdmin(request);
  await connectDB();

  const { id } = params;

  const machine = await Machine.findById(id).lean() as any;
  if (!machine) throw new Response("Not Found", { status: 404 });

  const [rawPatients, rawTherapists, rawSessions, settingsDoc] = await Promise.all([
    Patient.find({ machine_id: id }).lean(),
    Therapist.find({ machine_id: id }).lean(),
    Session.find({ machine_id: id }).lean(),
    Settings.findOne({ machine_id: id }).lean(),
  ]);

  const patients = (rawPatients as any[]).map((p) => ({
    server_id: p._id.toString(),
    machine_id: id,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    email: p.email,
    gender: p.gender,
    dob: p.dob,
    notes: p.notes,
    is_active: p.is_active,
    synced: 1,
  }));

  const therapists = (rawTherapists as any[]).map((t) => ({
    server_id: t._id.toString(),
    machine_id: id,
    first_name: t.first_name,
    last_name: t.last_name,
    phone: t.phone,
    email: t.email,
    gender: t.gender,
    is_active: t.is_active,
    synced: 1,
  }));

  const sessions = (rawSessions as any[]).map((s) => ({
    server_id: s._id.toString(),
    machine_id: id,
    therapist_server_id: s.therapist_id ? s.therapist_id.toString() : undefined,
    patient_server_id: s.patient_id ? s.patient_id.toString() : undefined,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_minutes: s.duration_minutes,
    water_temp_log: (s.water_temp_log ?? []).map((e: any) => e.temp),
    water_level_log: (s.water_level_log ?? []).map((e: any) => e.level),
    session_note: s.session_note,
    status: s.status,
    synced: 1,
    created_at: s.start_time,
  }));

  const settingsRow = (settingsDoc as any) ?? {};
  const settings = [{
    machine_id: id,
    default_session_minutes: settingsRow.default_session_minutes,
    max_temperature: settingsRow.max_temperature,
    default_temperature: settingsRow.default_temperature,
    water_inlet_valve: settingsRow.water_inlet_valve,
    flush_valve: settingsRow.flush_valve,
    blower_switch: settingsRow.blower_switch,
    heater_switch: settingsRow.heater_switch,
    ssid: machine.ssid,
    password: machine.password,
    mode: machine.mode,
    demo_sessions_used: machine.demo_sessions_used,
    demo_session_limit: machine.demo_session_limit,
    lock_screen_contact: machine.lock_screen_contact,
  }];

  const manifest = {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    machine_id: id,
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("sessions.json", JSON.stringify(sessions, null, 2));
  zip.file("therapists.json", JSON.stringify(therapists, null, 2));
  zip.file("patients.json", JSON.stringify(patients, null, 2));
  zip.file("settings.json", JSON.stringify(settings, null, 2));
  zip.file("reminder_logs.json", JSON.stringify([], null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const dateStamp = new Date().toISOString().split("T")[0];
  const fileName = `hydrotherapy-server-backup-${machine.serial_number}-${dateStamp}.zip`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
