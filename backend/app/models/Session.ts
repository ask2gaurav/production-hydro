import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist' },
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  start_time: { type: Date, required: true },
  end_time: { type: Date },
  duration_minutes: { type: Number, required: true },
  water_temp_log: [{ time: Date, temp: Number }],
  water_level_log: [{ time: Date, level: Number }],
  session_note: { type: String },
  status: { type: String },
  created_offline: { type: Boolean, default: false },
  synced_at: { type: Date, default: null }
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
