import mongoose from 'mongoose';

const TeamWorkerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: '' },
  truck: { type: String, default: '' },
  avatar: { type: String, default: '👤' },
  isPayroll: { type: Boolean, default: false },
  rate: { type: Number, default: 10 }
}, { _id: false });

const TeamRosterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'roster' },
  workers: [TeamWorkerSchema]
}, { timestamps: true });

export const TeamRoster = mongoose.models.TeamRoster || mongoose.model('TeamRoster', TeamRosterSchema);
