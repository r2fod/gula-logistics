import mongoose from 'mongoose';

const LogisticsWeekSchema = new mongoose.Schema({
  weekId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  meta: { type: Object, default: {} },
  team: { type: Array, default: [] },
  trucks: { type: Array, default: [] },
  schedule: { type: Object, default: {} },
  saturdaySpecial: { type: Object, default: {} },
  sundayMonday: { type: Object, default: {} }
}, {
  timestamps: true,
  strict: false // week shape evolves (per-task fields like mapsUrl/assigned); don't silently drop new ones
});

export const LogisticsWeek = mongoose.models.LogisticsWeek || mongoose.model('LogisticsWeek', LogisticsWeekSchema);
