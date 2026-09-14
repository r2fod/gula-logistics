import mongoose from 'mongoose';

const ClockEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  workerName: { type: String, required: true, index: true },
  role: { type: String, default: '' },
  isPayroll: { type: Boolean, default: false },
  rate: { type: Number, default: 10 },
  type: { type: String, enum: ['entrada', 'salida', 'pausa_inicio', 'pausa_fin', 'fichaje'], required: true },
  timestamp: { type: String, required: true },
  timeFormatted: { type: String, default: '' },
  dateFormatted: { type: String, default: '' },
  taskName: { type: String, default: 'Jornada Operativa' },
  note: { type: String, default: '' },
  durationHours: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  status: { type: String, default: 'completado' }
}, { 
  timestamps: true 
});

export const ClockEntry = mongoose.models.ClockEntry || mongoose.model('ClockEntry', ClockEntrySchema);
