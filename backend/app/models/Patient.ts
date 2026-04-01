import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema({
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone: { type: String },
  dob: { type: Date },
  notes: { type: String },
  is_active: { type: Boolean, default: true }
});

export default mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
