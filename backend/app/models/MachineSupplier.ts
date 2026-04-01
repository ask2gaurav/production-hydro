import mongoose from 'mongoose';

const MachineSupplierSchema = new mongoose.Schema({
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_date: { type: Date, default: Date.now }
});

MachineSupplierSchema.index({ machine_id: 1 }, { unique: true });

export default mongoose.models.MachineSupplier || mongoose.model('MachineSupplier', MachineSupplierSchema);
