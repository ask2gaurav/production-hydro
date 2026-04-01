import mongoose from 'mongoose';

const UserTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: String }],
  created_at: { type: Date, default: Date.now }
});

export default mongoose.models.UserType || mongoose.model('UserType', UserTypeSchema);
