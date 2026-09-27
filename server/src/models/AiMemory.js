import mongoose from 'mongoose';

// Reglas a largo plazo del asistente (Gemini). Solo las `activa` entran en el
// prompt; las que propone el asistente al leer lo que escribe el admin quedan
// como `propuesta` hasta que el admin las aprueba. Las antiguas, sin estado,
// cuentan como activas.
const aiMemorySchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  estado: { type: String, enum: ['activa', 'propuesta'], default: 'activa' },
  origen: { type: String, enum: ['manual', 'asistente'], default: 'manual' },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const AiMemory = mongoose.model('AiMemory', aiMemorySchema);
