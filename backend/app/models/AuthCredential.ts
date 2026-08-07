import mongoose from 'mongoose';

const AuthCredentialSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  last_login: { type: Date },
  is_active: { type: Boolean, default: true }
});

export default mongoose.models.AuthCredential || mongoose.model('AuthCredential', AuthCredentialSchema);
