import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { escucharServidorLento } from '../../data/servidorLento';

// Aviso arriba, en cualquier vista, mientras el servidor tarda en contestar (Render
// dormido): sin él la app parecía colgada. Lo guardado en el móvil se sigue viendo y
// los fichajes no se pierden (van a la cola). No tapa nada: no recibe clics.
export default function AvisoServidorLento() {
  const [lento, setLento] = useState(false);
  useEffect(() => escucharServidorLento(setLento), []);
  if (!lento) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4">
      <p role="status" className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-slate-900/95 px-3 py-1.5 text-[11px] font-semibold text-amber-200 shadow-lg animate-fadeIn">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Despertando el servidor… hasta 1 min
      </p>
    </div>
  );
}
