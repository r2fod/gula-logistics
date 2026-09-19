import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'server/.env' });

const ClockEntrySchema = new mongoose.Schema({
  worker: { type: String, required: true },
  weekId: { type: String, required: true },
  action: { type: String, enum: ['IN', 'OUT'], required: true },
  timestamp: { type: Date, default: Date.now },
  deviceInfo: { type: String },
  isManual: { type: Boolean, default: false },
  note: { type: String },
  pricePerHour: { type: Number }
});
const ClockEntry = mongoose.model('ClockEntry', ClockEntrySchema, 'clockentries');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const ricardoEntries = await ClockEntry.find({ worker: 'Ricardo' }).sort({ timestamp: 1 });
    console.log(`Found ${ricardoEntries.length} entries for Ricardo`);
    ricardoEntries.forEach(e => {
      console.log(`- [${e.action}] ${e.timestamp} (week: ${e.weekId}, manual: ${e.isManual}, price: ${e.pricePerHour})`);
    });
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
