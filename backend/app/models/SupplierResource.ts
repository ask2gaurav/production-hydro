import mongoose from 'mongoose';

const SupplierResourceSchema = new mongoose.Schema({
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updated_at: { type: Date, default: Date.now },
});

// Slug must be unique per supplier, not globally
SupplierResourceSchema.index({ supplier_id: 1, slug: 1 }, { unique: true });

export default mongoose.models.SupplierResource || mongoose.model('SupplierResource', SupplierResourceSchema);
