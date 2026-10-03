import React, { useState, useEffect } from 'react';
import { Settings, Lock, KeyRound, CheckCircle2, AlertCircle, RefreshCw, ClipboardCheck, ShieldOff } from 'lucide-react';
import { changeAdminPassword, cerrarSesionesEnAPI } from '../data/apiService';
import { useDialog } from '../contexts/DialogContext';
import FicharConEnlace from './ajustes/FicharConEnlace';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input } from './ui/Campo';

// Cambiar la clave de admin, y el acceso a la revisión y limpieza de fichajes (que
// vive en Fichajes: antes aquí había un «Optimizar y Limpiar Base de Datos» que
// vaciaba la papelera sin decir qué ni cuántos borraba).
export default function AdminSettingsModal({ isOpen, onClose, onIrAFichajes = null, onSesionesCerradas = null, fichajes = [] }) {
  const { alert, confirm } = useDialog();
  const [cerrando, setCerrando] = useState(false);
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

  // Anula todo lo enviado antes (sesiones de admin y enlaces de socias, también los
  // viejos con la sesión de admin dentro) sin cambiar la clave. Los trabajadores, no.
  const cerrarSesiones = async () => {
    const ok = await confirm('Se cerrará la sesión de admin en los demás dispositivos y dejarán de valer TODOS los enlaces de socias enviados, también los antiguos. Tú sigues dentro y la clave no cambia. Los enlaces de los trabajadores siguen valiendo. Después, reenvía el enlace de socias nuevo.', { type: 'warning', title: 'Cerrar todas las sesiones', confirmText: 'Cerrar sesiones' });
    if (!ok) return;
    setCerrando(true);
    const r = await cerrarSesionesEnAPI();
    setCerrando(false);
    if (!r.ok) return alert(r.error, { type: 'error' });
    onSesionesCerradas?.();
    await alert('Hecho: sesiones y enlaces de socias anteriores anulados. Copia el enlace de socias nuevo («Link Socias») y reenvíalo.', { type: 'success' });
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

      <FicharConEnlace fichajes={fichajes} />

      <div className="border-t border-slate-800 pt-5">
        <h4 className="text-xs font-bold text-amber-500">Seguridad</h4>
        <p className="mt-1 text-[11px] text-slate-400">Si un enlace de socias ha llegado a quien no debía, o hay una sesión abierta en un móvil perdido: lo anula todo sin cambiar la clave.</p>
        <button
          type="button"
          onClick={cerrarSesiones}
          disabled={cerrando}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
        >
          {cerrando ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldOff className="h-4 w-4" aria-hidden="true" />}
          Cerrar todas las sesiones y enlaces de socias
        </button>
      </div>

      {onIrAFichajes && (
        <div className="border-t border-slate-800 pt-5">
          <h4 className="text-xs font-bold text-amber-500">Mantenimiento</h4>
          <p className="mt-1 text-[11px] text-slate-400">En Fichajes: turnos muy largos para revisar, fichajes que sobran y la papelera.</p>
          <button
            type="button"
            onClick={onIrAFichajes}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 py-3 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Revisar y limpiar fichajes
          </button>
        </div>
      )}
    </Modal>
  );
}
