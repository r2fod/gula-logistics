import React, { useId } from 'react';
import { AlertTriangle, CheckCircle, Info, X, Trash2 } from 'lucide-react';
import { useCerrarConEscape } from '../../hooks/useCerrarConEscape';

export default function PremiumDialog({
  title,
  message,
  type = 'confirm',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  const idTitulo = useId();
  // Escape cierra SOLO este aviso (la misma pila que las ventanas: antes cerraba también
  // la de debajo). Enter ya no se escucha en toda la página: el foco entra en el aviso y
  // Enter pulsa el botón que lo tiene. Antes confirmaba aunque el foco estuviera en
  // «Cancelar» o en el botón de detrás, que además se volvía a pulsar.
  useCerrarConEscape(true, onCancel);

  // Determine icon and colors based on type
  let Icon = Info;
  let colorTheme = 'amber'; // default

  if (type === 'error' || type === 'delete') {
    Icon = type === 'delete' ? Trash2 : AlertTriangle;
    colorTheme = 'rose';
  } else if (type === 'success') {
    Icon = CheckCircle;
    colorTheme = 'emerald';
  } else if (type === 'confirm' || type === 'warning') {
    Icon = AlertTriangle;
    colorTheme = 'amber';
  } else if (type === 'info' || type === 'alert') {
    Icon = Info;
    colorTheme = 'blue';
  }

  const colorClasses = {
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      btn: 'bg-rose-500 hover:bg-rose-400 text-slate-950',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      btn: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    },
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      btn: 'bg-blue-500 hover:bg-blue-400 text-slate-950',
    },
  }[colorTheme];

  const isAlert = type === 'alert' || type === 'error' || type === 'success' || type === 'info';
  // Al abrir, el foco va al botón principal; si borra algo, a «Cancelar».
  const focoEnCancelar = !isAlert && type === 'delete';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />
      
      <div 
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 text-left align-middle shadow-2xl animate-entrarVentana motion-reduce:animate-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${colorClasses.bg} ${colorClasses.border} mb-4`}>
            <Icon className={`h-7 w-7 ${colorClasses.text}`} aria-hidden="true" />
          </div>
          
          <h3 id={idTitulo} className="text-lg font-bold text-white font-outfit mb-2">
            {title}
          </h3>
          
          <div className="mt-1">
            <p className="whitespace-pre-line text-sm text-slate-300">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row-reverse sm:gap-3 gap-2">
          <button
            type="button"
            className={`inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-colors sm:w-auto ${colorClasses.btn}`}
            onClick={onConfirm}
            autoFocus={!focoEnCancelar}
          >
            {confirmText}
          </button>
          {!isAlert && (
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-300 shadow-sm hover:bg-slate-700 hover:text-white transition-colors sm:mt-0 sm:w-auto"
              onClick={onCancel}
              autoFocus={focoEnCancelar}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
