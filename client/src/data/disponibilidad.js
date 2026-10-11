import { parecidoNombre } from './nombresTrabajadores';
import { aMinutos } from './horarios';

// Lo que el admin dice del equipo para UNA semana: "Tomás no puede el jueves",
// "Ana solo de 9 a 14 el viernes", "Luis descansa el sábado". Vive en
// week.meta.disponibilidad y lo respetan el generador del calendario, el reajuste
// del planning y Gemini.
//   { id, persona, dia: 'semana' | 'martes' … 'lunes', tipo: 'no' | 'descansa' | 'solo', desde?, hasta?, nota? }

export const DIAS_SEMANA = ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
export const NOMBRE_DIA = { martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo', lunes: 'Lunes' };
export const TIPOS_DISPONIBILIDAD = { no: 'No puede', descansa: 'Descansa', solo: 'Solo en un horario' };

// Por defecto, lo del Estatuto de los Trabajadores (art. 34.3): 9 h de jornada
// ordinaria y 12 h de descanso entre el final de una jornada y el comienzo de la
// siguiente. Se pueden cambiar por semana (week.meta.limites).
export const LIMITES_POR_DEFECTO = { maxHorasDia: 9, descansoMinHoras: 12 };

const dosDigitos = (hhmm) => { const m = aMinutos(hhmm); return m === null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export function limitesDe(semana) {
  const guardados = semana?.meta?.limites || {};
  const num = (v, min, max, porDefecto) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : porDefecto);
  return {
    maxHorasDia: num(guardados.maxHorasDia, 4, 16, LIMITES_POR_DEFECTO.maxHorasDia),
    descansoMinHoras: num(guardados.descansoMinHoras, 0, 16, LIMITES_POR_DEFECTO.descansoMinHoras),
  };
}

// { restriccion } si es válida, o { error } con lo que falta.
export function crearRestriccion({ persona, dia, tipo, desde = '', hasta = '', nota = '' } = {}) {
  const nombre = String(persona || '').trim();
  if (!nombre) return { error: 'Elige a la persona.' };
  if (dia !== 'semana' && !DIAS_SEMANA.includes(dia)) return { error: 'Elige el día.' };
  if (!TIPOS_DISPONIBILIDAD[tipo]) return { error: 'Elige si no puede, descansa o solo en un horario.' };
  const restriccion = { id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, persona: nombre, dia, tipo };
  if (tipo === 'solo') {
    const [a, b] = [aMinutos(desde), aMinutos(hasta)];
    if (a === null || b === null || a === b) return { error: 'Pon el horario en el que sí puede (desde y hasta, HH:MM).' };
    Object.assign(restriccion, { desde: dosDigitos(desde), hasta: dosDigitos(hasta) });
  }
  if (String(nota).trim()) restriccion.nota = String(nota).trim().slice(0, 120);
  return { restriccion };
}

export const restriccionesDe = (semana) => (Array.isArray(semana?.meta?.disponibilidad) ? semana.meta.disponibilidad : [])
  .filter(r => r?.persona && (r.dia === 'semana' || DIAS_SEMANA.includes(r.dia)) && TIPOS_DISPONIBILIDAD[r.tipo]);

// La restricción que impide a `persona` hacer una tarea de `dia` de `ini` a `fin`
// (minutos desde las 00:00 de ese día; `fin` puede pasar de 1440), o null.
export function restriccionQueBloquea(restricciones = [], persona, dia, ini, fin) {
  for (const r of restricciones) {
    // Su nombre o su nombre seguido de más; no "lo contiene" ("Ana no puede" bloqueaba a Mariana).
    if (parecidoNombre(r.persona, persona) < 2 || (r.dia !== 'semana' && r.dia !== dia)) continue;
    if (r.tipo !== 'solo') return r;
    const desde = aMinutos(r.desde);
    let hasta = aMinutos(r.hasta);
    if (desde === null || hasta === null) continue;
    if (hasta <= desde) hasta += 1440;
    if (ini < desde || fin > hasta) return r;
  }
  return null;
}


// ─── Disponibilidad FIJA (ficha del equipo, para todas las semanas) ─────────
// [{ dia, tipo, desde, hasta }] en cada persona de /api/roster ("Luis, desde las 15:00").
export const restriccionesDelEquipo = (equipo = []) => equipo.flatMap(w => (Array.isArray(w?.disponibilidad) ? w.disponibilidad : [])
  .filter(r => r && (r.dia === 'semana' || DIAS_SEMANA.includes(r.dia)) && TIPOS_DISPONIBILIDAD[r.tipo])
  .map((r, i) => ({ ...r, id: `fija|${w.name}|${i}`, persona: w.name, fija: true })));

// Las que cuentan en una semana: las fijas del equipo más las de esa semana. Solo las
// de la semana se guardan en ella (meta.disponibilidad).
export const restriccionesEfectivas = (semana, equipo = []) => [...restriccionesDelEquipo(equipo), ...restriccionesDe(semana)];


// ─── Días agrupados y textos ─────────────────────────────────────────────────
// Se guarda un apunte por día, pero se elige y se lee por grupos: "de lunes a viernes",
// "el fin de semana". Así una persona que "entre semana solo puede desde las 15:00"
// no son cinco líneas, y a Gemini le llega en una (menos tokens).
const ORDEN_CALENDARIO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const ENTRE_SEMANA = ORDEN_CALENDARIO.slice(0, 5);
const FIN_DE_SEMANA = ['sabado', 'domingo'];

// Lo que se puede elegir como "día" en los formularios.
export const OPCIONES_DIA = [
  { valor: 'semana', etiqueta: 'Todos los días' },
  { valor: 'entresemana', etiqueta: 'De lunes a viernes' },
  { valor: 'finde', etiqueta: 'Fin de semana' },
  ...DIAS_SEMANA.map(d => ({ valor: d, etiqueta: NOMBRE_DIA[d] })),
];
export const diasDeOpcion = (valor) => (valor === 'entresemana' ? ENTRE_SEMANA : valor === 'finde' ? FIN_DE_SEMANA : [valor]);

// "de lunes a viernes" → los días en orden de calendario (da la vuelta si hace falta).
export function diasEntre(desde, hasta) {
  const [a, b] = [ORDEN_CALENDARIO.indexOf(desde), ORDEN_CALENDARIO.indexOf(hasta)];
  if (a < 0 || b < 0) return [];
  const dias = [];
  for (let i = a; ; i = (i + 1) % 7) { dias.push(ORDEN_CALENDARIO[i]); if (i === b) break; }
  return dias;
}

const EN_PLURAL = { sabado: 'sábados', domingo: 'domingos' };
const iguales = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// Semanal ("el jueves", "toda la semana") o fija ("los jueves"; todos los días, nada).
function textoDias(dias, fija) {
  const orden = ORDEN_CALENDARIO.filter(d => dias.includes(d));
  if (dias.includes('semana') || orden.length === 7) return fija ? '' : 'toda la semana';
  if (iguales(orden, ENTRE_SEMANA)) return 'de lunes a viernes';
  if (iguales(orden, FIN_DE_SEMANA)) return 'el fin de semana';
  const nombres = orden.map(d => (fija ? EN_PLURAL[d] || NOMBRE_DIA[d].toLowerCase() : NOMBRE_DIA[d].toLowerCase()));
  return `${fija ? 'los' : 'el'} ${nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0]}`;
}

// Junta las que solo se diferencian en el día: [{ persona, tipo, desde, hasta, fija, nota, dias, ids }].
export function agruparRestricciones(lista = []) {
  const grupos = new Map();
  lista.forEach((r, i) => {
    const clave = [r.persona, r.tipo, r.desde || '', r.hasta || '', r.fija ? 1 : 0, r.nota || ''].join('|');
    if (!grupos.has(clave)) grupos.set(clave, { ...r, dias: [], ids: [], indices: [] });
    const g = grupos.get(clave);
    g.dias.push(r.dia);
    g.ids.push(r.id);
    g.indices.push(i);
  });
  return [...grupos.values()];
}

// "Luis solo puede desde las 15:00 de lunes a viernes", "Ana no puede el jueves"; sin
// persona (ficha del equipo): "desde las 15:00 de lunes a viernes", "no los lunes".
export function textoGrupo(g, { conPersona = true } = {}) {
  const cuando = textoDias(g.dias || [g.dia], !!g.fija || !conPersona);
  const franja = g.hasta === '23:59' ? `desde las ${g.desde}` : ['00:00', '06:00'].includes(g.desde) ? `hasta las ${g.hasta}` : `de ${g.desde} a ${g.hasta}`;
  const que = g.tipo === 'solo' ? `${conPersona ? 'solo puede ' : ''}${franja}` : g.tipo === 'descansa' ? 'descansa' : conPersona ? 'no puede' : 'no';
  const sufijo = cuando || (g.tipo === 'no' && !conPersona ? 'disponible' : '');
  return `${conPersona ? `${g.persona} ` : ''}${que}${sufijo ? ` ${sufijo}` : ''}${g.nota ? ` (${g.nota})` : ''}`;
}

// Una sola: "Tomás no puede el jueves", "Ana solo puede de 09:00 a 14:00 el viernes".
export const textoRestriccion = (r) => textoGrupo({ ...r, dias: [r.dia] });
// Corta, para la ficha y el bloque del equipo: "desde las 15:00", "no los lunes".
export const textoDisponibilidadFija = (r) => textoGrupo({ ...r, dias: [r.dia] }, { conPersona: false });
// Todas, agrupadas por días, en una línea cada grupo (avisos, prompts, listas).
export const textosAgrupados = (lista = [], opciones) => agruparRestricciones(lista).map(g => textoGrupo(g, opciones));

// Del formulario (persona, un día o un grupo de OPCIONES_DIA, tipo, horas) a las
// restricciones de cada día → { restricciones } o { error }. Con una sola hora basta:
// sin "hasta" es "a partir de esa hora"; sin "desde", "hasta esa hora".
export function restriccionesDeFormulario({ persona, dia, tipo, desde = '', hasta = '' }) {
  const horas = tipo === 'solo' && (desde || hasta) ? { desde: desde || '06:00', hasta: hasta || '23:59' } : { desde, hasta };
  const restricciones = [];
  for (const d of diasDeOpcion(dia)) {
    const { restriccion, error } = crearRestriccion({ persona, dia: d, tipo, ...horas });
    if (error) return { error };
    restricciones.push(restriccion);
  }
  return { restricciones };
}
