import mongoose from 'mongoose';

// Archivos subidos desde la app (de momento, el PDF del alquiler de un camión).
// En la base y no en el disco: el de Render (plan gratuito) se borra en cada
// despliegue y cada vez que el servidor se duerme. `clave`: aleatoria, es lo que
// va en la dirección (`/api/logistics/documentos/<clave>`); solo lo abre el admin.
const DocumentoSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  nombre: { type: String, default: '' },
  tipo: { type: String, default: 'application/pdf' },
  tamano: { type: Number, default: 0 },
  datos: { type: Buffer, required: true }
}, {
  timestamps: true
});

export const Documento = mongoose.models.Documento || mongoose.model('Documento', DocumentoSchema, 'documentos');
