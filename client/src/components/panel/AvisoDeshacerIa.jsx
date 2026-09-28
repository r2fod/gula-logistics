import React, { useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';

// Tras aplicar lo que propuso Gemini a una semana: un aviso con "Deshacer", que la
// deja como estaba antes. Si desde entonces la semana tuvo otros cambios (tareas
// marcadas, ediciones…), la confirmación lo dice: deshacer también los perdería.
export default function AvisoDeshacerIa({ aviso, cambiada = false, onDeshacer, onCerrar }) {
  const { confirm } = useDialog();
  const [deshaciendo, setDeshaciendo] = useState(false);
  if (!aviso) return null;

  const deshacer = async () => {
    const texto = cambiada
      ? `Desde que se aplicó, «${aviso.nombre}» ha tenido otros cambios (por ejemplo, tareas marcadas). Deshacer la dejará como estaba antes de Gemini y esos cambios se perderán. ¿Seguir?`
      : `«${aviso.nombre}» volverá a estar como antes de aplicar lo que propuso Gemini. ¿Seguir?`;
    if (!(await confirm(texto, { type: 'warning', confirmText: 'Deshacer' }))) return;
    setDeshaciendo(true);
    await onDeshacer();
    setDeshaciendo(false);
  };

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-[11px] sm:text-xs text-indigo-100 animate-aparecer motion-reduce:animate-none">
      <span>Se aplicó la planificación de Gemini a <b>{aviso.nombre}</b>.</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={deshacer}
          disabled={deshaciendo}
          className="flex items-center gap-1 rounded-lg border border-indigo-400/40 bg-slate-950/60 px-2.5 py-1 font-bold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> {deshaciendo ? 'Deshaciendo…' : 'Deshacer'}
        </button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="rounded-lg p-1 text-indigo-300 hover:text-white">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
