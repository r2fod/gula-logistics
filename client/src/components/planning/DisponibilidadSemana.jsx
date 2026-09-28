import React, { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, Plus, Scale, Sparkles, X } from 'lucide-react';
import Boton from '../ui/Boton';
import BarraProgreso from '../ui/BarraProgreso';
import Desplegable from '../ui/Desplegable';
import { Input, Selector } from '../ui/Campo';
import PropuestaAplicable from '../asistente/PropuestaAplicable';
import { crearRestriccion, DIAS_SEMANA, limitesDe, NOMBRE_DIA, restriccionesDe, restriccionesDelEquipo, restriccionesEfectivas, textoRestriccion, TIPOS_DISPONIBILIDAD } from '../../data/disponibilidad';
import { interpretarDisponibilidad } from '../../data/interpretarPeticion';
import { reajustarSemana, revisarPlanning } from '../../data/optimizadorPlanning';
import { avisosDePropuesta } from '../../data/diffSemana';
import { estimarHorasPlanning } from '../../data/estimadoPlanning';
import { formatearHoras } from '../../data/formatoFinanciero';

const OPCIONES_HORAS = [8, 9, 10, 11, 12];
const OPCIONES_DESCANSO = [8, 10, 11, 12];
const FORM_VACIO = { persona: '', dia: 'semana', tipo: 'no', desde: '', hasta: '' };

// Qué puede cada persona esta semana y cuántas horas hace (solo admin, en el Cuadrante).
// Lo que se diga aquí lo respetan el reparto (optimizadorPlanning.js), el calendario al
// regenerar el borrador y Gemini. Al añadir algo se propone el reajuste MÍNIMO del
// planning (solo cambia a quien ya no puede) para aplicarlo de un clic.
// `onGuardar(parcial)`: guarda esos campos en la semana (meta, schedule…).
export default function DisponibilidadSemana({ semana, equipo = [], esBorrador = false, onGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'error' | 'ok', texto }
  const [propuesta, setPropuesta] = useState(null); // { base, semana, cambios, avisos }

  const restricciones = restriccionesDe(semana); // las de esta semana (se pueden quitar aquí)
  const fijas = restriccionesDelEquipo(equipo); // las de la ficha de cada persona
  const limites = limitesDe(semana);
  const incumple = useMemo(() => revisarPlanning(semana, { restricciones: restriccionesEfectivas(semana, equipo), limites: limitesDe(semana) }), [semana, equipo]);
  const horas = useMemo(() => estimarHorasPlanning(semana, equipo).porPersona, [semana, equipo]);
  const maxHoras = Math.max(1, ...horas.map(p => p.horas));

  const guardarMeta = (cambios) => onGuardar({ meta: { ...semana.meta, ...cambios } });

  // Reajuste sobre la semana con la disponibilidad nueva: se enseña antes de aplicarlo.
  const proponer = (base, modo = 'reparar') => {
    const r = reajustarSemana(base, { equipo, restricciones: restriccionesEfectivas(base, equipo), limites: limitesDe(base), modo });
    if (r.error) { setMensaje({ tipo: 'error', texto: r.error }); return; }
    if (!r.cambios.length) {
      setPropuesta(null);
      setMensaje({ tipo: 'ok', texto: modo === 'reparar' ? 'El planning ya lo cumple: no hace falta cambiar a nadie.' : 'No hay un reparto mejor que el actual.' });
      return;
    }
    setPropuesta({ ...r, base, avisos: avisosDePropuesta({ actual: semana, propuesta: r.semana, equipo, restricciones: restriccionesDe(base), extra: r.avisos }) });
  };

  const anadir = (nuevas) => {
    const disponibilidad = [...restricciones, ...nuevas];
    guardarMeta({ disponibilidad });
    setMensaje({ tipo: 'ok', texto: `Guardado: ${nuevas.map(textoRestriccion).join('; ')}.` });
    proponer({ ...semana, meta: { ...semana.meta, disponibilidad } });
  };

  const anadirDesdeTexto = (e) => {
    e.preventDefault();
    const entendidas = interpretarDisponibilidad(texto, equipo);
    if (!entendidas) { setMensaje({ tipo: 'error', texto: 'No lo he entendido. Prueba «Luis no puede el jueves» o «Ana solo de 9 a 14 el viernes», o usa las opciones de abajo.' }); return; }
    setTexto('');
    anadir(entendidas);
  };

  const anadirDesdeFormulario = () => {
    const { restriccion, error } = crearRestriccion(form);
    if (error) { setMensaje({ tipo: 'error', texto: error }); return; }
    setForm(FORM_VACIO);
    anadir([restriccion]);
  };

  const quitar = (id) => {
    guardarMeta({ disponibilidad: restricciones.filter(r => r.id !== id) });
    setPropuesta(null);
    setMensaje(null);
  };

  const aplicar = () => {
    const { schedule, saturdaySpecial, sundayMonday } = propuesta.semana;
    onGuardar({ schedule, saturdaySpecial, sundayMonday, meta: propuesta.base.meta });
    setMensaje({ tipo: 'ok', texto: `Planning reajustado: ${propuesta.cambios.length} ${propuesta.cambios.length === 1 ? 'tarea cambia' : 'tareas cambian'} de persona.` });
    setPropuesta(null);
  };

  const campo = (clave) => ({ value: form[clave], onChange: (e) => setForm(f => ({ ...f, [clave]: e.target.value })) });

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left sm:px-5"
      >
        <CalendarClock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block whitespace-nowrap text-sm font-extrabold uppercase tracking-wider text-slate-200">Disponibilidad</span>
          <span className="block text-[11px] text-slate-500">
            {restricciones.length ? `${restricciones.length} ${restricciones.length === 1 ? 'indicación' : 'indicaciones'}` : 'Quién no puede, descansos y límite de horas'}
            {incumple.length > 0 && <span className="text-amber-300"> · {incumple.length} {incumple.length === 1 ? 'aviso' : 'avisos'}</span>}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <Desplegable abierto={abierto}>
        <div className="space-y-4 border-t border-slate-800 px-3.5 py-4 sm:px-5">
          <form onSubmit={anadirDesdeTexto} className="flex flex-col gap-2 sm:flex-row">
            <Input id="disp-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: Luis no puede el jueves" tamano="sm" aria-label="Indicación sobre el equipo" />
            <Boton tipo="submit" variante="primario" className="shrink-0 text-xs" disabled={!texto.trim()}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Añadir
            </Boton>
          </form>

          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.2fr_auto]">
            <Selector id="disp-persona" tamano="sm" aria-label="Persona" {...campo('persona')}>
              <option value="">Persona…</option>
              {equipo.map(w => <option key={w.name} value={w.name}>{w.name}</option>)}
            </Selector>
            <Selector id="disp-dia" tamano="sm" aria-label="Día" {...campo('dia')}>
              <option value="semana">Toda la semana</option>
              {DIAS_SEMANA.map(d => <option key={d} value={d}>{NOMBRE_DIA[d]}</option>)}
            </Selector>
            <Selector id="disp-tipo" tamano="sm" aria-label="Qué pasa" {...campo('tipo')}>
              {Object.entries(TIPOS_DISPONIBILIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selector>
            <Boton variante="secundario" className="text-xs" onClick={anadirDesdeFormulario}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir
            </Boton>
            {form.tipo === 'solo' && (
              <div className="grid grid-cols-2 gap-2 min-[360px]:col-span-2 sm:col-span-4 sm:max-w-xs">
                <Input id="disp-desde" type="time" tamano="sm" aria-label="Desde" {...campo('desde')} />
                <Input id="disp-hasta" type="time" tamano="sm" aria-label="Hasta" {...campo('hasta')} />
              </div>
            )}
          </div>

          {mensaje && (
            <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-xs ${mensaje.tipo === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{mensaje.texto}</p>
          )}

          {(fijas.length > 0 || restricciones.length > 0) && (
            <ul className="flex flex-wrap gap-2">
              {fijas.map(r => (
                <li key={r.id} title="Todas las semanas: se cambia en la ficha del equipo" className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                  <span>{textoRestriccion(r)}</span>
                  <span className="rounded bg-slate-800 px-1.5 text-[10px] font-bold uppercase text-slate-400">fija</span>
                </li>
              ))}
              {restricciones.map(r => (
                <li key={r.id} className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 py-1 pl-2.5 pr-1 text-xs text-slate-200">
                  <span>{textoRestriccion(r)}</span>
                  <button type="button" onClick={() => quitar(r.id)} aria-label={`Quitar: ${textoRestriccion(r)}`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">Máximo al día</span>
              <Selector id="disp-max" tamano="xs" className="w-auto" value={limites.maxHorasDia} onChange={(e) => guardarMeta({ limites: { ...limites, maxHorasDia: Number(e.target.value) } })}>
                {OPCIONES_HORAS.map(h => <option key={h} value={h}>{h} h</option>)}
              </Selector>
            </label>
            <label className="flex items-center gap-2">
              <span className="whitespace-nowrap">Descanso entre jornadas</span>
              <Selector id="disp-descanso" tamano="xs" className="w-auto" value={limites.descansoMinHoras} onChange={(e) => guardarMeta({ limites: { ...limites, descansoMinHoras: Number(e.target.value) } })}>
                {OPCIONES_DESCANSO.map(h => <option key={h} value={h}>{h} h</option>)}
              </Selector>
            </label>
          </div>

          {horas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Horas planificadas esta semana</p>
              {/* Una sola rejilla (las filas son `contents`): la columna de nombres mide lo
                  que el más largo, así nada se corta y las barras quedan alineadas. */}
              <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-xs">
                {horas.map(p => (
                  <li key={p.nombre} className="contents">
                    <span className="whitespace-nowrap text-slate-300">{p.nombre}</span>
                    <BarraProgreso porcentaje={(p.horas / maxHoras) * 100} pista="h-2 bg-slate-950 border border-slate-800" etiqueta={`Horas de ${p.nombre}`} />
                    <span className="text-right font-mono tabular-nums text-slate-400">{formatearHoras(p.horas)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incumple.length > 0 && !propuesta && (
            <div role="alert" className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <ul className="list-disc space-y-0.5 pl-4">{incumple.map((a, i) => <li key={i}>{a}</li>)}</ul>
              <Boton variante="secundario" className="text-xs" onClick={() => proponer(semana)}>Reajustar para cumplirlo</Boton>
            </div>
          )}

          {esBorrador && !propuesta && (
            <Boton variante="secundario" className="text-xs" onClick={() => proponer(semana, 'equilibrar')}>
              <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Repartir de nuevo equilibrando horas
            </Boton>
          )}

          {propuesta && (
            <PropuestaAplicable
              titulo="Reajuste propuesto (sin Gemini): revísalo antes de aplicarlo"
              actual={semana} propuesta={propuesta.semana} avisos={propuesta.avisos}
              onAplicar={aplicar} onDescartar={() => setPropuesta(null)}
            />
          )}
        </div>
      </Desplegable>
    </section>
  );
}
