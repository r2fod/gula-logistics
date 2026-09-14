import mongoose from 'mongoose';

const TeamMemberSchema = new mongoose.Schema({
  role: { type: String, required: true },
  members: { type: String, required: true }
});

const MetaSchema = new mongoose.Schema({
  week: { type: String, required: true },
  dateRange: { type: String, required: true },
  status: { type: String, required: true }
});

const LogisticsSchema = new mongoose.Schema({
  meta: MetaSchema,
  team: [TeamMemberSchema]
}, { timestamps: true });

export const Logistics = mongoose.models.Logistics || mongoose.model('Logistics', LogisticsSchema);
