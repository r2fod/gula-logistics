import React, { useEffect, useMemo, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { fetchAjustesAdmin, guardarAjustesAdmin } from '../../data/apiService';
import { quienFichaConEnlace } from '../../data/fichajes';
import { useDialog } from '../../contexts/DialogContext';

// Interruptor «Exigir el enlace personal para fichar» (Configuración). Cada fichaje que
// llega con el enlace de esa persona va firmado; con esto activado, sin él no se puede
// fichar (el admin sí, con su sesión). Enseña quién ficha ya con su enlace y quién no,
// para saber cuándo se puede activar sin dejar a nadie fuera.
export default function FicharConEnlace({ fichajes = [] }) {
  const { alert, confirm } = useDialog();
  const [exigido, setExigido] = useState(null); // null = cargando
  const [sinLeer, setSinLeer] = useState(null); // por qué no se pudo leer: 'sesion' | 'conexion'
  const [guardando, setGuardando] = useState(false);
  const { conEnlace, sinEnlace } = useMemo(() => quienFichaConEnlace(fichajes), [fichajes]);

  useEffect(() => {
    let vigente = true;
    fetchAjustesAdmin().then(a => {
      if (!vigente) return;
      if (a?.sinSesion) setSinLeer('sesion');
      else if (a) setExigido(!!a.exigirEnlaceAlFichar);
      else setSinLeer('conexion');
    });
    return () => { vigente = false; };
  }, []);

  const cambiar = async () => {
    const activar = !exigido;
    if (activar && sinEnlace.length && !(await confirm(
      `${sinEnlace.join(', ')} ${sinEnlace.length === 1 ? 'aún ficha' : 'aún fichan'} sin su enlace: no ${sinEnlace.length === 1 ? 'podrá' : 'podrán'} fichar hasta que abra${sinEnlace.length === 1 ? '' : 'n'} el suyo («Enlaces de WhatsApp»). ¿Activarlo igualmente?`,
      { type: 'warning', title: 'Exigir el enlace para fichar', confirmText: 'Activar' }
    ))) return;
    setGuardando(true);
    const r = await guardarAjustesAdmin({ exigirEnlaceAlFichar: activar });
    setGuardando(false);
    if (!r) return alert('No se pudo guardar. Revisa la conexión y vuelve a intentarlo.', { type: 'error' });
    setExigido(r.exigirEnlaceAlFichar);
  };

  return (
    <div className="border-t border-slate-800 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
            <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> Fichar solo con el enlace personal
          </h4>
          <p className="mt-1 text-[11px] text-slate-400">Así nadie puede fichar por otra persona con solo la dirección del servidor. Tú sigues pudiendo fichar por cualquiera.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!exigido}
          aria-label="Exigir el enlace personal para fichar"
          onClick={cambiar}
          disabled={exigido === null || guardando}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${exigido ? 'border-emerald-400/60 bg-emerald-500/80' : 'border-slate-700 bg-slate-800'}`}
        >
          <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] duration-200 motion-reduce:transition-none ${exigido ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="mt-2 space-y-1 text-[11px]">
        {exigido === null && <p className="text-slate-500">{sinLeer === 'sesion' ? 'Tu sesión de admin ya no vale (se cerraron las sesiones o cambió la clave): sal y vuelve a entrar.' : sinLeer ? 'No se pudo leer este ajuste (sin conexión con el servidor). Cierra y vuelve a abrir Configuración.' : 'Cargando…'}</p>}
        {conEnlace.length > 0 && <p className="text-emerald-300">Ya fichan con su enlace: {conEnlace.join(', ')}.</p>}
        {sinEnlace.length > 0 && <p className="text-amber-300">Aún fichan sin él: {sinEnlace.join(', ')}. Mándales su enlace desde «Enlaces de WhatsApp».</p>}
        {!conEnlace.length && !sinEnlace.length && <p className="text-slate-500">Aún no hay fichajes nuevos para saber quién usa ya su enlace.</p>}
      </div>
    </div>
  );
}
