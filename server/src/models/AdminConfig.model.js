import mongoose from 'mongoose';

// Singleton document (configKey: 'admin') holding the hashed admin password.
// The password itself never lives in the repo or in client code — only its
// bcrypt hash, stored in MongoDB Atlas and managed via /api/auth routes.
const AdminConfigSchema = new mongoose.Schema({
  configKey: { type: String, required: true, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  // Bumped on every password change so previously issued tokens (including
  // long-lived shared "socias" links) stop working immediately.
  tokenVersion: { type: Number, default: 1 },
  // Versión de los enlaces de socias (solo lectura): subirla anula todos los
  // enlaces de socias ya enviados sin tocar la sesión de admin.
  sociasVersion: { type: Number, default: 1 },
  // Versión de los enlaces firmados de los trabajadores (ven su propio saldo):
  // subirla los anula todos. NO depende de la contraseña de admin: cambiarla no
  // obliga a reenviar el enlace a todo el equipo.
  trabajadoresVersion: { type: Number, default: 1 },
  // Con esto activado, para fichar hace falta el enlace personal de esa persona (o la
  // sesión de admin): nadie puede fichar por otro con solo la URL de la API.
  exigirEnlaceAlFichar: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const AdminConfig = mongoose.models.AdminConfig || mongoose.model('AdminConfig', AdminConfigSchema);
