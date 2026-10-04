import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, KeyRound, Lock, RefreshCw } from 'lucide-react';
import { changeAdminPassword } from '../../data/apiService';
import Desplegable from '../ui/Desplegable';
import { Campo, Input } from '../ui/Campo';

// Cambiar la clave de admin, plegado: se abre solo si se va a usar (antes eran tres
// campos de contraseña lo primero de Configuración). Cambiarla anula todas las
// sesiones y enlaces anteriores. `onHecho`: se llama al guardarla bien.
export default function CambiarClave({ onHecho = null }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (!actual.trim()) return setError('Introduce tu contraseña actual.');
    if (nueva.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (nueva !== repetida) return setError('Las contraseñas no coinciden.');
    setGuardando(true);
    const r = await changeAdminPassword(actual.trim(), nueva.trim());
    setGuardando(false);
    if (!r.success) return setError(r.error || 'No se pudo actualizar la contraseña.');
    setHecho(true);
    onHecho?.();
  };

  const campos = [
    { etiqueta: 'Contraseña actual', icono: Lock, valor: actual, cambiar: setActual, placeholder: 'Tu clave actual…', autoComplete: 'current-password' },
    { etiqueta: 'Nueva contraseña', icono: KeyRound, valor: nueva, cambiar: setNueva, placeholder: 'Al menos 6 caracteres…', autoComplete: 'new-password' },
    { etiqueta: 'Repite la nueva', icono: Lock, valor: repetida, cambiar: setRepetida, placeholder: 'Repite la clave…', autoComplete: 'new-password' },
  ];

  return (
    <div className="rounded-2xl border border-slate-800">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-200 sm:px-4"
      >
        <span className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-amber-400" aria-hidden="true" /> Cambiar la clave de admin</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <Desplegable abierto={abierto}>
        <form onSubmit={guardar} className="space-y-3 border-t border-slate-800 px-3 pb-3 pt-3 sm:px-4">
          {campos.map(({ etiqueta, icono, valor, cambiar, placeholder, autoComplete }) => (
            <Campo key={etiqueta} etiqueta={etiqueta} icono={icono} colorIcono="text-slate-400">
              <Input type="password" value={valor} onChange={(e) => cambiar(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} redondeo="2xl" className="w-full" />
            </Campo>
          ))}
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
          {hecho && (
            <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Clave cambiada: todas las sesiones y enlaces anteriores han quedado anulados.
            </p>
          )}
          <button type="submit" disabled={guardando} className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 text-xs font-extrabold text-slate-950 transition-colors hover:bg-slate-200 disabled:opacity-60">
            {guardando ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            {guardando ? 'Guardando…' : 'Guardar la clave nueva'}
          </button>
        </form>
      </Desplegable>
    </div>
  );
}
