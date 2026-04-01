import mongoose from 'mongoose';

const MachineOwnerSchema = new mongoose.Schema({
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sale_date: { type: Date, default: Date.now },
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }
});

MachineOwnerSchema.index({ machine_id: 1 }, { unique: true });

export default mongoose.models.MachineOwner || mongoose.model('MachineOwner', MachineOwnerSchema);
