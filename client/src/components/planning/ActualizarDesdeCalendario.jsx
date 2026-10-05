import React, { useState } from 'react';
import { CalendarSync, Check } from 'lucide-react';
import Boton from '../ui/Boton';
import { fetchCalendarioApuntes } from '../../data/apiService';
import { anadirAlPlanning, eventosQueFaltan, fechasParaCalendario } from '../../data/actualizarDesdeCalendario';
import { NOMBRE_DIA } from '../../data/disponibilidad';
import { fechaLocal } from '../../data/fechasSemana';
import { formatWeekdayShortDay } from '../../utils/dateUtils';

const TIPO = { boda: 'Boda', comunion: 'Comunión', corporativo: 'Corporativo', cumpleanos: 'Cumpleaños', produccion: 'Producción' };

// «Actualizar desde calendario» (Cuadrante, solo admin): lee el Calendario Gula de la
// semana, enseña lo que falta en el planning con sus tareas propuestas y solo añade
// lo que se deja marcado (actualizarDesdeCalendario.js; lo que ya hay no se toca).
// Props: semana, equipo, onGuardar(parcial) y leerApuntes (por defecto, el servidor).
export default function ActualizarDesdeCalendario({ semana, equipo = [], onGuardar, leerApuntes = fetchCalendarioApuntes }) {
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'error' | 'ok', texto }
  const [propuesta, setPropuesta] = useState(null); // { faltan, avisos }
  const [quitadas, setQuitadas] = useState(() => new Set()); // claves de tareas desmarcadas

  const leer = async () => {
    setMensaje(null);
    setPropuesta(null);
    const rango = fechasParaCalendario(semana);
    if (!rango) { setMensaje({ tipo: 'error', texto: 'No se pueden leer las fechas de la semana.' }); return; }
    setLeyendo(true);
    try {
      const r = await leerApuntes(rango.desde, rango.hasta);
      if (r?.configurado === false) { setMensaje({ tipo: 'error', texto: 'El calendario no está configurado en el servidor (faltan las variables CALENDARIO_* en Render).' }); return; }
      if (!r || r.error) { setMensaje({ tipo: 'error', texto: `No se pudo leer el calendario: ${r?.error || 'sin respuesta'}.` }); return; }
      const res = eventosQueFaltan(semana, r.apuntes || [], { equipo });
      if (res.error) { setMensaje({ tipo: 'error', texto: res.error }); return; }
      if (!res.faltan.length) { setMensaje({ tipo: 'ok', texto: 'El planning ya tiene todos los eventos del calendario de esta semana.' }); return; }
      setQuitadas(new Set());
      setPropuesta(res);
    } finally {
      setLeyendo(false);
    }
  };

  const elegidas = propuesta ? propuesta.faltan.flatMap(e => e.tareas).filter(t => !quitadas.has(t.clave)) : [];
  const alternar = (clave) => setQuitadas(prev => {
    const s = new Set(prev);
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    return s;
  });

  const anadir = () => {
    const eventos = propuesta.faltan.filter(e => e.tareas.some(t => !quitadas.has(t.clave)));
    const nueva = anadirAlPlanning(semana, elegidas, eventos);
    onGuardar({ schedule: nueva.schedule, saturdaySpecial: nueva.saturdaySpecial, sundayMonday: nueva.sundayMonday, events: nueva.events });
    setPropuesta(null);
    setMensaje({ tipo: 'ok', texto: `Añadid${elegidas.length === 1 ? 'a 1 tarea' : `as ${elegidas.length} tareas`} de ${eventos.map(e => e.nombre).join(', ')}. Revísalas en el cuadrante.` });
  };

  return (
    <section aria-label="Actualizar desde el calendario" className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <CalendarSync className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />Calendario Gula
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Trae los eventos de esta semana que faltan en el planning (producciones, cumpleaños, lo apuntado después). Lo que ya hay no se toca.</p>
        </div>
        <Boton variante="primario" onClick={leer} disabled={leyendo} className="w-full sm:w-auto text-xs whitespace-nowrap">
          <CalendarSync className={`w-4 h-4 ${leyendo ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
          {leyendo ? 'Leyendo el calendario…' : 'Actualizar desde calendario'}
        </Boton>
      </div>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-[11px] rounded-xl px-3 py-2 border ${mensaje.tipo === 'error' ? 'text-rose-300 bg-rose-500/10 border-rose-500/20' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'}`}>
          {mensaje.texto}
        </p>
      )}

      {propuesta && (
        <div className="space-y-3 animate-fadeIn">
          <p className="text-[11px] text-slate-300">
            Faltan en el planning <b>{propuesta.faltan.length === 1 ? '1 evento' : `${propuesta.faltan.length} eventos`}</b>. Deja marcadas las tareas que quieras añadir:
          </p>
          {propuesta.faltan.map(e => (
            <div key={e.nombre} className="rounded-2xl border border-sky-500/20 bg-slate-950/60 p-3 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-bold text-white break-words">{e.nombre}</span>
                <span className="text-[11px] text-sky-300">{TIPO[e.tipo] || e.tipo}</span>
                <span className="text-[11px] text-slate-400">
                  {e.fechas.map(f => formatWeekdayShortDay(fechaLocal(f))).join(', ')}
                  {e.hora ? ` · ${e.hora}` : ''}{e.pax ? ` · ${e.pax} pax` : ''}{e.sitio ? ` · ${e.sitio}` : ''}
                </span>
              </div>
              {e.tareas.length === 0 && <p className="text-[11px] text-slate-500">El calendario no da para proponer tareas: añádelas a mano.</p>}
              <ul className="space-y-1.5">
                {e.tareas.map(t => (
                  <li key={t.clave}>
                    <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={!quitadas.has(t.clave)} onChange={() => alternar(t.clave)} className="mt-0.5 accent-sky-500 shrink-0" />
                      <span className="min-w-0 break-words">
                        <b className="text-slate-200">{NOMBRE_DIA[t.dia]}</b> · {t.tarea.timeFrame} · {t.tarea.text || t.tarea.details}
                        <span className="text-slate-500"> — {(t.tarea.assigned || []).length ? t.tarea.assigned.join(', ') : 'sin asignar'}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {propuesta.avisos.length > 0 && (
            <ul className="text-[11px] text-amber-300/90 space-y-0.5 list-disc pl-4">
              {propuesta.avisos.slice(0, 6).map(a => <li key={a}>{a}</li>)}
            </ul>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Boton variante="primario" onClick={anadir} disabled={!elegidas.length} className="text-xs">
              <Check className="w-4 h-4" aria-hidden="true" />Añadir {elegidas.length === 1 ? '1 tarea' : `${elegidas.length} tareas`} al planning
            </Boton>
            <Boton onClick={() => setPropuesta(null)} className="text-xs">Descartar</Boton>
          </div>
        </div>
      )}
    </section>
  );
}
