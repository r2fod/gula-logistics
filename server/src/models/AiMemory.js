import mongoose from 'mongoose';

const aiMemorySchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const AiMemory = mongoose.model('AiMemory', aiMemorySchema);
