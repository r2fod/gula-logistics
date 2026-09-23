import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X, Trash2 } from 'lucide-react';

export default function PremiumDialog({
  title,
  message,
  type = 'confirm',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

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
      shadow: 'shadow-amber-500/10',
      btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      shadow: 'shadow-rose-500/10',
      btn: 'bg-rose-500 hover:bg-rose-400 text-slate-950',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      shadow: 'shadow-emerald-500/10',
      btn: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    },
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      shadow: 'shadow-blue-500/10',
      btn: 'bg-blue-500 hover:bg-blue-400 text-slate-950',
    },
  }[colorTheme];

  const isAlert = type === 'alert' || type === 'error' || type === 'success' || type === 'info';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />
      
      <div 
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 text-left align-middle shadow-2xl transition-all shadow-${colorClasses.shadow} animate-in fade-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${colorClasses.bg} ${colorClasses.border} mb-4`}>
            <Icon className={`h-7 w-7 ${colorClasses.text}`} aria-hidden="true" />
          </div>
          
          <h3 className="text-lg font-bold text-white font-['Outfit'] mb-2">
            {title}
          </h3>
          
          <div className="mt-1">
            <p className="text-sm text-slate-300">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row-reverse sm:gap-3 gap-2">
          <button
            type="button"
            className={`inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-colors sm:w-auto ${colorClasses.btn}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          {!isAlert && (
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-300 shadow-sm hover:bg-slate-700 hover:text-white transition-colors sm:mt-0 sm:w-auto"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
