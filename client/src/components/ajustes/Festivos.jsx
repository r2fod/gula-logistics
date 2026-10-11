import React, { useMemo, useState } from 'react';
import { PartyPopper, Plus, X } from 'lucide-react';
import { Input } from '../ui/Campo';
import Boton from '../ui/Boton';
import { aIso, fechaLocal, sumarDias } from '../../data/fechasSemana';
import { festivoEn, festivosEntre } from '../../data/festivos';
import { guardarFestivosLocales } from '../../data/festivosGuardados';
import { useFestivosLocales } from '../../hooks/useFestivosLocales';
import { formatDate } from '../../utils/dateUtils';

// Festivos (Configuración). Los nacionales y los de la Comunitat Valenciana ya los sabe
// la app; aquí se añaden los locales (los dos de cada municipio, un cierre del
// proveedor…). Ese día no se ponen recogidas ni devoluciones de alquiler: el Cuadrante
// avisa, la flota no deja elegirlo y los borradores las pasan a otro día.
export default function Festivos({ hoy = new Date() }) {
  const locales = useFestivosLocales();
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Los próximos (tres meses), para ver de un vistazo cuáles se están teniendo en cuenta.
  const proximos = useMemo(() => festivosEntre(aIso(hoy), aIso(sumarDias(hoy, 92)), locales), [hoy, locales]);

  const guardar = async (lista, hecho) => {
    setGuardando(true);
    const ok = await guardarFestivosLocales(lista);
    setGuardando(false);
    setMensaje(ok ? { tipo: 'ok', texto: hecho } : { tipo: 'error', texto: 'No se pudo guardar: revisa la conexión o vuelve a iniciar sesión de administrador.' });
    return ok;
  };

  const anadir = async (e) => {
    e.preventDefault();
    if (!fecha) return;
    const yaEsta = festivoEn(fecha, locales);
    if (yaEsta) { setMensaje({ tipo: 'error', texto: `Ese día ya es festivo (${yaEsta.nombre}).` }); return; }
    if (await guardar([...locales, { fecha, nombre: nombre.trim() || 'Festivo local' }], 'Festivo añadido.')) { setFecha(''); setNombre(''); }
  };

  return (
    <section aria-labelledby="titulo-festivos" className="space-y-3 border-t border-slate-800 pt-5">
      <div>
        <h4 id="titulo-festivos" className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
          <PartyPopper className="h-3.5 w-3.5" aria-hidden="true" /> Festivos
        </h4>
        <p className="mt-1 text-[11px] text-slate-400">
          En festivo cierran los proveedores y los alquileres: la app avisa si hay una recogida o una devolución ese día y no deja elegirlo en la flota. Los nacionales y los de la Comunitat Valenciana ya están; añade aquí los de vuestro municipio.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Próximos tres meses</p>
        {proximos.length ? (
          <ul className="mt-1.5 space-y-1 text-xs text-slate-200">
            {proximos.map(f => (
              <li key={f.fecha} className="flex items-center justify-between gap-2">
                <span className="min-w-0"><span className="tabular-nums text-slate-400">{formatDate(fechaLocal(f.fecha))}</span> · {f.nombre}{f.previsto ? ' (previsto)' : ''}</span>
                {f.local && <span className="shrink-0 rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">Local</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-slate-500">Ninguno.</p>
        )}
      </div>

      {locales.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Añadidos por ti</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {locales.map(f => (
              <li key={f.fecha} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 py-0.5 pl-2 pr-0.5 text-xs text-slate-200">
                <span className="tabular-nums">{formatDate(fechaLocal(f.fecha))}</span> · {f.nombre}
                <button type="button" disabled={guardando} onClick={() => guardar(locales.filter(x => x.fecha !== f.fecha), 'Festivo quitado.')} aria-label={`Quitar el festivo del ${formatDate(fechaLocal(f.fecha))}`} className="rounded p-1 text-slate-500 hover:text-rose-300 disabled:opacity-50">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={anadir} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Input id="festivo-fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Día del festivo" tamano="sm" />
        <Input id="festivo-nombre" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre del festivo" tamano="sm" />
        <Boton tipo="submit" variante="dashed" className="text-xs" disabled={guardando || !fecha}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir
        </Boton>
      </form>
      {mensaje && <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-xs ${mensaje.tipo === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{mensaje.texto}</p>}
    </section>
  );
}
