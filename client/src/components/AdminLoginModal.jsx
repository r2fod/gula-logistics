import React, { useState } from 'react';
import { ShieldCheck, KeyRound, AlertCircle, RefreshCw } from 'lucide-react';
import { loginAdmin } from '../data/apiService';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input } from './ui/Campo';

export default function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError('');

    const result = await loginAdmin(password.trim());

    setLoading(false);

    if (result.success) {
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Clave de Administrador incorrecta.');
    }
  };

  return (
    <Modal onCerrar={onClose} ancho="md" className="space-y-6">
      <CabeceraModal icono={ShieldCheck} titulo="Acceso Administrador" subtitulo="Panel de Gestión Exclusivo para Raúl" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo etiqueta="Contraseña de Raúl (Admin)" icono={KeyRound}>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Introduce clave de admin..."
            autoFocus
            texto="destacado"
            redondeo="2xl" className="w-full shadow-inner transition-all"
          />
        </Campo>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
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
            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Entrar como Admin</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
        <p>💡 <b>Nota:</b> El Panel de Administrador permite editar/borrar fichajes, crear semanas, lanzar Gemini AI y distribuir links de WhatsApp a la plantilla y socias.</p>
      </div>
    </Modal>
  );
}
