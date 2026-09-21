import React, { useState, useEffect } from 'react';
import { Settings, Lock, KeyRound, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { changeAdminPassword } from '../data/apiService';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input } from './ui/Campo';

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

  const campos = [
    { etiqueta: 'Contraseña Actual', icono: Lock, colorIcono: 'text-slate-400', valor: currentPassword, cambiar: setCurrentPassword, placeholder: 'Tu clave actual...' },
    { etiqueta: 'Nueva Contraseña', icono: KeyRound, colorIcono: 'text-amber-400', valor: newPassword, cambiar: setNewPassword, placeholder: 'Introduce la nueva clave...' },
    { etiqueta: 'Confirmar Contraseña', icono: Lock, colorIcono: 'text-slate-400', valor: confirmPassword, cambiar: setConfirmPassword, placeholder: 'Repite la clave...' },
  ];

  return (
    <Modal onCerrar={onClose} ancho="md" className="space-y-6">
      <CabeceraModal icono={Settings} tono="slate" titulo="Configuración" subtitulo="Panel de Ajustes de Administrador" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {campos.map(({ etiqueta, icono, colorIcono, valor, cambiar, placeholder }) => (
          <Campo key={etiqueta} etiqueta={etiqueta} icono={icono} colorIcono={colorIcono}>
            <Input
              type="password"
              value={valor}
              onChange={(e) => cambiar(e.target.value)}
              placeholder={placeholder}
              texto="destacado"
              redondeo="2xl"
              className="w-full shadow-inner transition-all"
            />
          </Campo>
        ))}

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

        <div className="pt-2 border-t border-slate-800">
          <h4 className="text-xs font-bold text-amber-500 mb-3">Mantenimiento de Sistema</h4>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm("¿Seguro que quieres optimizar la Base de Datos? Se purgarán los fichajes borrados.")) {
                try {
                  const { optimizeDatabase } = await import('../data/apiService');
                  const res = await optimizeDatabase();
                  alert(res.message || 'Optimizado con éxito');
                } catch(e) {
                  alert('Error: ' + e.message);
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Optimizar y Limpiar Base de Datos
          </button>
        </div>

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
    </Modal>
  );
}
