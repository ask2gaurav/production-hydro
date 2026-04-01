import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  user_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserType', required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
  billing_address: { type: String },
  date_created: { type: Date, default: Date.now },
  date_modified: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
  machine_id: { type: String }, // which machine they belong to, if applicable
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // supplier who manages this owner
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
