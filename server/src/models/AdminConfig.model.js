import mongoose from 'mongoose';

// Singleton document (configKey: 'admin') holding the hashed admin password.
// The password itself never lives in the repo or in client code — only its
// bcrypt hash, stored in MongoDB Atlas and managed via /api/auth routes.
const AdminConfigSchema = new mongoose.Schema({
  configKey: { type: String, required: true, unique: true, default: 'admin' },
  passwordHash: { type: String, required: true },
  // Bumped on every password change so previously issued tokens (including
  // long-lived shared "socias" links) stop working immediately.
  tokenVersion: { type: Number, default: 1 }
}, {
  timestamps: true
});

export const AdminConfig = mongoose.models.AdminConfig || mongoose.model('AdminConfig', AdminConfigSchema);
