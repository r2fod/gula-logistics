import mongoose from 'mongoose';

const BreakdownItemSchema = new mongoose.Schema({
  concept: { type: String, required: true },
  amount: { type: Number, required: true },
  isPositive: { type: Boolean, default: true },
  date: { type: String, default: '' },
  timestamp: { type: String, default: '' }
}, { _id: false });

const ShiftPurseSchema = new mongoose.Schema({
  date: { type: String },
  hours: { type: Number },
  range: { type: String }
}, { _id: false });

// Sin valores reales por defecto a propósito — las cifras del acuerdo
// (horas, tarifas, importes) son datos sensibles de cada trabajador y
// viven solo en su documento de Mongo, nunca en el código. Un trabajador
// nuevo con isSpecialPurse debe traer su propio purseInfo completo al
// crearse (ver Saldos & Acuerdos → Admin).
const PurseInfoSchema = new mongoose.Schema({
  totalHours: { type: Number, default: 0 },
  hourlyRate: { type: Number, default: 0 },
  grossBase: { type: Number, default: 0 },
  housingDeduction: { type: Number, default: 0 },
  netFixedAt80h: { type: Number, default: 0 },
  extraRateAfter80h: { type: Number, default: 0 },
  consumedHours: { type: Number, default: 0 },
  consumedValue: { type: Number, default: 0 },
  remainingHoursForExtra: { type: Number, default: 0 },
  shifts: [ShiftPurseSchema]
}, { _id: false });

const WorkerBalanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, index: true },
  role: { type: String, default: '' },
  avatar: { type: String, default: '👤' },
  status: { type: String, default: 'Neutral' },
  statusType: { type: String, default: 'neutral' }, // success | danger | neutral | payroll
  currentBalance: { type: Number, default: 0 },
  hourlyRate: { type: Number, default: 10 },
  agreements: [{ type: String }],
  breakdown: [BreakdownItemSchema],
  hasTransportBonus: { type: Boolean, default: false },
  transportBonusText: { type: String, default: '' },
  isSpecialPurse: { type: Boolean, default: false },
  purseInfo: PurseInfoSchema,
  phone: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { 
  timestamps: true 
});

export const WorkerBalance = mongoose.models.WorkerBalance || mongoose.model('WorkerBalance', WorkerBalanceSchema);
