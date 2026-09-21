// Lógica del Historial de Fichajes, separada de la pantalla: filtrar, agrupar por
// día y unir cada fichaje con el turno al que pertenece. Son funciones puras,
// probadas aparte (fichajesAgrupados.test.js).

export const TIPOS_FICHAJE = ['entrada', 'salida', 'fichaje'];

const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const instante = (e) => new Date(e?.timestamp).getTime();

// Día local del fichaje ("2026-9-21"), o "sin-fecha" si no tiene marca de tiempo legible.
export function claveDia(entrada) {
  const t = instante(entrada);
  if (isNaN(t)) return 'sin-fecha';
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export const hayFiltros = ({ consulta = '', tipo = 'todos', persona = 'todas' } = {}) =>
  consulta.trim() !== '' || tipo !== 'todos' || persona !== 'todas';

// Fichajes que cumplen los filtros: texto (en el nombre, la tarea, la nota o el
// tipo, sin distinguir mayúsculas ni acentos), tipo y persona.
export function filtrarFichajes(entradas = [], { consulta = '', tipo = 'todos', persona = 'todas' } = {}) {
  const q = plano(consulta).trim();
  return entradas.filter(e => {
    if (tipo !== 'todos' && e.type !== tipo) return false;
    if (persona !== 'todas' && e.workerName !== persona) return false;
    if (!q) return true;
    return plano([e.workerName, e.taskName, e.note, e.type].join(' ')).includes(q);
  });
}

// Grupos por día, del más reciente al más antiguo; dentro de cada día, en orden
// cronológico (así se lee la entrada antes que su salida). `turnos` son los de
// pairShiftsFromEntries: las horas de un turno cuentan en el día en que EMPIEZA
// (igual que en el Resumen Financiero), aunque su salida caiga ya en el siguiente.
// Devuelve [{ clave, fecha, entradas, horas, turnos }]; los fichajes sin fecha
// legible van al final en el grupo "sin-fecha".
export function agruparPorDia(entradas = [], turnos = []) {
  const grupos = new Map();
  [...entradas].sort((a, b) => (instante(a) || 0) - (instante(b) || 0)).forEach(e => {
    const clave = claveDia(e);
    if (!grupos.has(clave)) grupos.set(clave, { clave, fecha: isNaN(instante(e)) ? null : new Date(instante(e)), entradas: [], horas: 0, turnos: 0 });
    grupos.get(clave).entradas.push(e);
  });
  turnos.forEach(t => {
    const g = grupos.get(claveDia(t.startEntry));
    if (g) { g.horas += t.durationHours || 0; g.turnos += 1; }
  });
  return [...grupos.values()].sort((a, b) => (b.fecha?.getTime() ?? -Infinity) - (a.fecha?.getTime() ?? -Infinity));
}

// { [id de fichaje]: turno } para las salidas (el turno que cierran), para
// enseñar en cada salida cuánto duró y cuánto costó.
export function turnosPorSalida(turnos = []) {
  return Object.fromEntries(turnos.filter(t => t.endEntry?.id).map(t => [t.endEntry.id, t]));
}

// Cuántos fichajes hay de cada tipo (para los contadores de los filtros).
export function contarPorTipo(entradas = []) {
  const cuenta = { todos: entradas.length };
  TIPOS_FICHAJE.forEach(t => { cuenta[t] = entradas.filter(e => e.type === t).length; });
  return cuenta;
}

export const personasDe = (entradas = []) => [...new Set(entradas.map(e => e.workerName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
