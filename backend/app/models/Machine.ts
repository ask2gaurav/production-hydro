import mongoose from 'mongoose';

const MachineSchema = new mongoose.Schema({
  model_name: { type: String, required: true },
  serial_number: { type: String, required: true, unique: true },
  machine_status: { type: String, enum: ['Active', 'Inactive', 'Maintenance'], default: 'Active' },
  production_date: { type: Date },
  asset_type: { type: String },
  installation_date: { type: Date },
  installation_location: { type: String },
  operating_status: { type: String, default: 'offline' }, // e.g. 'demo_locked'
  // Demo Mode Config
  mode: { type: String, enum: ['demo', 'full'], default: 'demo' },
  demo_session_limit: { type: Number, default: 10 },
  demo_sessions_used: { type: Number, default: 0 },
  demo_extended_at: [{
    extended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    previous_limit: Number,
    new_limit: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  activated_full_mode_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  activated_full_mode_at: { type: Date, default: null },
  lock_screen_contact: {
    supplier_name: String,
    supplier_email: String,
    supplier_phone: String,
    supplier_available_hours: String,
    custom_message: String
  },
  last_seen_date: { type: Date },
}, { timestamps: true });

export default mongoose.models.Machine || mongoose.model('Machine', MachineSchema);
