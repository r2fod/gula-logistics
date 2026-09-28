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
  rate: { type: Number, default: 10 },
  backup: { type: Boolean, default: false }, // solo si hace falta: entra cuando los demás van cargados
  nota: { type: String, default: '' },       // "cuando no está en cocina"
  disponibilidad: { type: [DisponibilidadFijaSchema], default: [] },
}, { _id: false });

const TeamRosterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'roster' },
  workers: [TeamWorkerSchema]
}, { timestamps: true });

export const TeamRoster = mongoose.models.TeamRoster || mongoose.model('TeamRoster', TeamRosterSchema);
