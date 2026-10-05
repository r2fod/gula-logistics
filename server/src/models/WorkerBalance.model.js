import mongoose from 'mongoose';

// `date` (AAAA-MM-DD) y `tipo` ('turno' | 'transporte' | 'bolsa' | 'ajuste' | 'pago')
// los pone la app al crear cada concepto (los antiguos no los tienen: se deducen del
// texto). `pago` = dinero ya entregado al trabajador (efectivo, Bizum, adelanto).
// `horasBolsa`: horas de bolsa de un turno apuntado a mano en un mes del acuerdo que
// no es el primero (client/src/data/bolsaHoras.js).
const BreakdownItemSchema = new mongoose.Schema({
  concept: { type: String, required: true },
  amount: { type: Number, required: true },
  isPositive: { type: Boolean, default: true },
  date: { type: String, default: '' },
  timestamp: { type: String, default: '' },
  tipo: { type: String, default: '' },
  horasBolsa: { type: Number }
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
// crearse (ver Saldos & Acuerdos → Admin). `desde`/`hasta` (AAAA-MM): meses del
// acuerdo; con ellos la bolsa se renueva cada mes (client/src/data/bolsaHoras.js).
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
  desde: { type: String, default: '' },
  hasta: { type: String, default: '' },
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
