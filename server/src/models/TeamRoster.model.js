import mongoose from 'mongoose';

// Disponibilidad FIJA de una persona, para todas las semanas ("Luis, a partir de las
// 15:00"). La de una semana concreta va en esa semana (client/src/data/disponibilidad.js).
const DisponibilidadFijaSchema = new mongoose.Schema({
  dia: { type: String, required: true },   // 'semana' o 'martes'…'lunes'
  tipo: { type: String, required: true },  // 'no' | 'descansa' | 'solo'
  desde: { type: String, default: '' },    // HH:MM (solo con 'solo')
  hasta: { type: String, default: '' },
}, { _id: false });

const TeamWorkerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: '' },
  truck: { type: String, default: '' },
  avatar: { type: String, default: '👤' },
  isPayroll: { type: Boolean, default: false },
  rate: { type: Number }, // sin ella, la por defecto de `tarifas`
  backup: { type: Boolean, default: false }, // solo si hace falta: entra cuando los demás van cargados
  nota: { type: String, default: '' },       // "cuando no está en cocina"
  disponibilidad: { type: [DisponibilidadFijaSchema], default: [] },
}, { _id: false });

// Tarifas por defecto (€/h de quien está fuera de nómina y de quien está en ella, y la
// ayuda de transporte por día): las pone el admin y viven SOLO aquí, nunca en el código.
// Se usan cuando alguien no tiene la suya. Sin valores por defecto: sin dato no se inventa.
const TarifasSchema = new mongoose.Schema({
  extra: { type: Number },
  nomina: { type: Number },
  transporte: { type: Number },
}, { _id: false });

const TeamRosterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'roster' },
  workers: [TeamWorkerSchema],
  tarifas: TarifasSchema,
}, { timestamps: true });

export const TeamRoster = mongoose.models.TeamRoster || mongoose.model('TeamRoster', TeamRosterSchema);
