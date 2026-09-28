import { coincideNombre } from './nombresTrabajadores';
import { aMinutos } from './horarios';

// Lo que el admin dice del equipo para UNA semana: "Persona1 no puede el jueves",
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
    if (!coincideNombre(r.persona, persona) || (r.dia !== 'semana' && r.dia !== dia)) continue;
    if (r.tipo !== 'solo') return r;
    const desde = aMinutos(r.desde);
    let hasta = aMinutos(r.hasta);
    if (desde === null || hasta === null) continue;
    if (hasta <= desde) hasta += 1440;
    if (ini < desde || fin > hasta) return r;
  }
  return null;
}

// "Persona1 no puede el jueves", "Ana solo puede de 09:00 a 14:00 el viernes".
export function textoRestriccion(r) {
  const cuando = r.dia === 'semana' ? 'toda la semana' : `el ${NOMBRE_DIA[r.dia].toLowerCase()}`;
  const que = r.tipo === 'solo' ? `solo puede de ${r.desde} a ${r.hasta}` : r.tipo === 'descansa' ? 'descansa' : 'no puede';
  return `${r.persona} ${que} ${cuando}${r.nota ? ` (${r.nota})` : ''}`;
}
