import React, { useState, useEffect } from 'react';
import { Settings, Lock, X, KeyRound, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { changeAdminPassword } from '../data/apiService';

export default function AdminSettingsModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!currentPassword.trim()) {
      setError('Introduce tu contraseña actual.');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const result = await changeAdminPassword(currentPassword.trim(), newPassword.trim());
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } else {
      setError(result.error || 'No se pudo actualizar la contraseña.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6">

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-['Outfit']">Configuración</h3>
            <p className="text-xs text-slate-400">Panel de Ajustes de Administrador</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wider flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Contraseña Actual</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Tu clave actual..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-amber-300 font-bold px-4 py-3 rounded-2xl text-sm outline-none transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wider flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Nueva Contraseña</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Introduce la nueva clave..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-amber-300 font-bold px-4 py-3 rounded-2xl text-sm outline-none transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wider flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Confirmar Contraseña</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la clave..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-amber-300 font-bold px-4 py-3 rounded-2xl text-sm outline-none transition-all shadow-inner"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>¡Contraseña actualizada! Todas las sesiones y enlaces anteriores han quedado invalidados.</span>
            </div>
          )}

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-white hover:bg-slate-200 text-slate-950 text-xs font-extrabold shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Guardar Clave</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
