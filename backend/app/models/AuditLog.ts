import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resource_id: { type: String },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now },
  reason: { type: String } // optional reason (for demo extensions, etc)
});

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
