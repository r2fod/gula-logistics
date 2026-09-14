import mongoose from 'mongoose';

const LogisticsWeekSchema = new mongoose.Schema({
  weekId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  meta: { type: Object, default: {} },
  team: { type: Array, default: [] },
  schedule: { type: Object, default: {} },
  fleet: { type: Object, default: {} },
  checklist: { type: Array, default: [] },
  notes: { type: String, default: '' }
}, { 
  timestamps: true 
});

export const LogisticsWeek = mongoose.models.LogisticsWeek || mongoose.model('LogisticsWeek', LogisticsWeekSchema);
