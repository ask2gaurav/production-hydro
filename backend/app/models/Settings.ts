import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  machine_id: { type: String, required: true, unique: true }, // string ID passed in env or ObjectId 
  default_session_minutes: { type: Number, default: 40 },
  max_temperature: { type: Number, default: 40 },
  default_temperature: { type: Number, default: 37 },
  water_inlet_valve: { type: Boolean, default: false },
  flush_valve: { type: Boolean, default: false },
  blower_switch: { type: Boolean, default: false },
  heater_switch: { type: Boolean, default: false },
  global_demo_session_limit: { type: Number, default: 10 } // Global default admin setting
});

export default mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
