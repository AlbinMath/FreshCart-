import mongoose from 'mongoose';

const wasteLogSchema = new mongoose.Schema({
  sellerRef: {
    uid: { type: String, required: true, index: true },
    sellerUniqueNumber: { type: String, default: '' }
  },
  product: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    category: { type: String, default: '' }
  },
  quantity: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' }
}, { timestamps: true });

const WasteLog = mongoose.model('WasteLog', wasteLogSchema);
export default WasteLog;