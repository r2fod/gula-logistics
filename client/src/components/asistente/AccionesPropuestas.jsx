import React, { useState } from 'react';
import { CalendarX2, Check, CircleAlert, Euro, UserCog, Wallet } from 'lucide-react';

const ICONOS = { tarifa: Euro, apunte: Wallet, festivo: CalendarX2, disponibilidad: UserCog };

// Lo que el asistente propone hacer en la app (accionesIa.js): una tarjeta por acción con
// su efecto exacto y una casilla para quitarla. No se aplica nada hasta pulsar «Aplicar».
// Las que no se pueden hacer salen con el motivo y sin casilla; tras aplicar, cada una dice
// si se hizo. `onAplicar(acciones)` → [{ ok, error }] en el mismo orden (null: sin sesión
// de admin, solo se enseñan).
export default function AccionesPropuestas({ acciones = [], onAplicar = null }) {
  const [marcadas, setMarcadas] = useState(() => acciones.map(a => !!a.ok));
  const [resultados, setResultados] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const elegidas = acciones.filter((a, i) => a.ok && marcadas[i]);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await onAplicar(elegidas);
      setResultados(acciones.map(a => (elegidas.includes(a) ? r[elegidas.indexOf(a)] || { ok: false, error: 'No se ha podido comprobar.' } : null)));
    } catch (err) {
      setResultados(acciones.map(a => (elegidas.includes(a) ? { ok: false, error: err.message } : null)));
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <ul className="space-y-2" aria-label="Cambios propuestos en la app">
        {acciones.map((a, i) => {
          const Icono = ICONOS[a.tipo] || Check;
          const r = resultados?.[i];
          const tono = !a.ok || r?.ok === false ? 'border-rose-500/30 bg-rose-500/10' : r?.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-700 bg-slate-950';
          return (
            <li key={i} className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${tono}`}>
              {a.ok && !resultados && onAplicar ? (
                <input
                  type="checkbox"
                  checked={marcadas[i]}
                  onChange={(e) => setMarcadas(m => m.map((x, j) => (j === i ? e.target.checked : x)))}
                  aria-label={`Incluir: ${a.texto}`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                />
              ) : (
                <span className={`mt-0.5 shrink-0 ${a.ok ? 'text-amber-300' : 'text-rose-300'}`} aria-hidden="true">
                  {a.ok ? <Icono className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="break-words font-semibold text-slate-100">{a.texto}</p>
                {a.aviso && <p className="text-amber-300/90">{a.aviso}</p>}
                {!a.ok && <p className="text-rose-300">No se puede: {a.error}</p>}
                {r && <p className={r.ok ? 'font-semibold text-emerald-300' : 'text-rose-300'}>{r.ok ? 'Hecho.' : r.error}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {!onAplicar && <p className="text-[11px] text-slate-400">Para aplicarlo hace falta la sesión de administrador.</p>}
      {onAplicar && !resultados && (
        <button
          type="button"
          onClick={aplicar}
          disabled={aplicando || !elegidas.length}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {aplicando ? 'Aplicando…' : elegidas.length ? `Aplicar ${elegidas.length === 1 ? 'este cambio' : `estos ${elegidas.length} cambios`}` : 'Elige qué aplicar'}
        </button>
      )}
    </div>
  );
}
