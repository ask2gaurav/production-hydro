import mongoose from 'mongoose';

const TherapistSchema = new mongoose.Schema({
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  is_active: { type: Boolean, default: true }
});

export default mongoose.models.Therapist || mongoose.model('Therapist', TherapistSchema);
