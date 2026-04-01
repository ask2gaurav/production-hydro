import mongoose from 'mongoose';

const InvoiceSchema = new mongoose.Schema({
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  machine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  total_amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  balance: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Partial', 'Paid'], default: 'Pending' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date_created: { type: Date, default: Date.now },
  payments: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String
  }]
});

export default mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
