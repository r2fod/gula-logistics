import { getWeekRange } from './taskPlanning';
import { formatDayMonthShort, formatMonthYear, formatWeekdayShort, formatMonthShort } from '../utils/dateUtils';

// Periodos del Resumen Financiero: semana, mes o año, o todo el histórico.
//
// La SEMANA es la operativa de la app: de martes a lunes (el lunes es la cola de
// la semana anterior, ver getWeekRange/resolveTaskDate), así "Semana 3" del
// planning y la semana del resumen son la misma. Mes y año son los naturales.
// Un turno cuenta en el periodo en que EMPIEZA: uno que cruza la medianoche
// (boda del sábado) no se parte en dos.

export const MODOS_PERIODO = [
  { id: 'semana', nombre: 'Semana' },
  { id: 'mes', nombre: 'Mes' },
  { id: 'anio', nombre: 'Año' },
  { id: 'todo', nombre: 'Todo' },
];

const DIA_MARTES = 2;
const aMedianoche = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Martes (00:00) de la semana operativa a la que pertenece una fecha.
export function inicioSemanaOperativa(fecha) {
  const d = aMedianoche(fecha);
  d.setDate(d.getDate() - ((d.getDay() - DIA_MARTES + 7) % 7));
  return d;
}

const corto = formatDayMonthShort;
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// { modo, desde, hasta, etiqueta }: `desde` incluido y `hasta` excluido; en
// "todo" ambos son null. `semanas` (el mapa de semanas del planning) solo sirve
// para poner el nombre ("Semana 3") a la semana que coincide.
export function rangoDePeriodo(modo, ancla = new Date(), semanas = {}) {
  if (modo === 'mes') {
    const desde = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const hasta = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1);
    return { modo, desde, hasta, etiqueta: capitalizar(formatMonthYear(desde)) };
  }
  if (modo === 'anio') {
    const desde = new Date(ancla.getFullYear(), 0, 1);
    return { modo, desde, hasta: new Date(ancla.getFullYear() + 1, 0, 1), etiqueta: String(ancla.getFullYear()) };
  }
  if (modo === 'todo') return { modo, desde: null, hasta: null, etiqueta: 'Todo el histórico' };

  const desde = inicioSemanaOperativa(ancla);
  const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 7);
  const ultimo = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - 1);
  const del = Object.values(semanas || {}).find(w => {
    if (w?.meta?.status === 'Borrador') return false;
    const r = getWeekRange(w, ancla);
    return r && r.start.getTime() === desde.getTime();
  });
  const fechas = `${corto(desde)} – ${corto(ultimo)} ${ultimo.getFullYear()}`;
  return { modo: 'semana', desde, hasta, etiqueta: del?.name ? `${del.name} · ${fechas}` : fechas };
}

// Ancla del periodo anterior (-1) o siguiente (+1).
export function moverPeriodo(modo, ancla, paso) {
  if (modo === 'semana') { const d = aMedianoche(ancla); d.setDate(d.getDate() + 7 * paso); return d; }
  if (modo === 'mes') return new Date(ancla.getFullYear(), ancla.getMonth() + paso, 1);
  if (modo === 'anio') return new Date(ancla.getFullYear() + paso, 0, 1);
  return ancla;
}

// Turnos que empiezan dentro del periodo (todos si es "todo"). Un turno sin
// fecha legible no se puede colocar en ningún periodo concreto: solo cuenta en "todo".
export function turnosDelPeriodo(shifts = [], rango) {
  if (!rango?.desde) return shifts;
  return shifts.filter(s => {
    const t = new Date(s.startEntry?.timestamp).getTime();
    return !isNaN(t) && t >= rango.desde.getTime() && t < rango.hasta.getTime();
  });
}

// Semanas del planning que empiezan dentro del periodo (todas si es "todo"). Sirven
// para los pax del desglose por evento: en la vista de una semana, "Evento X" trae
// los pax de ESA semana, no los de otra donde el mismo evento se repite.
export function semanasDelPeriodo(semanas = {}, rango, ahora = new Date()) {
  if (!rango?.desde) return semanas;
  return Object.fromEntries(Object.entries(semanas || {}).filter(([, w]) => {
    const r = getWeekRange(w, ahora);
    return r && r.start.getTime() >= rango.desde.getTime() && r.start.getTime() < rango.hasta.getTime();
  }));
}

export const costeTotal = (shifts = []) => shifts.reduce((acc, s) => acc + (s.cost || 0), 0);

// Cuánto ha subido (+) o bajado (-) un importe respecto al del periodo anterior,
// en %. null si el anterior es cero: no hay con qué comparar.
export function variacionPorcentual(actual, anterior) {
  if (!(anterior > 0)) return null;
  return ((actual - anterior) / anterior) * 100;
}

const claveDia = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const claveMes = (d) => `${d.getFullYear()}-${d.getMonth() + 1}`;

// Coste y horas por tramo dentro del periodo, para la gráfica de evolución:
// por DÍA en una semana, por SEMANA en un mes, por MES en un año (y en "todo",
// desde el primer mes con fichajes hasta el último). Los tramos sin turnos salen
// a cero, para que la gráfica no se salte días o meses. `turnos` ya viene
// filtrado por el periodo (turnosDelPeriodo). Devuelve [{ clave, etiqueta, coste, horas }].
export function serieDelPeriodo(turnos = [], rango) {
  const tramos = [];
  const nuevo = (clave, etiqueta) => { const t = { clave, etiqueta, coste: 0, horas: 0 }; tramos.push(t); return t; };
  const sumar = (mapa, clave, s) => { const t = mapa.get(clave); if (t) { t.coste += s.cost || 0; t.horas += s.durationHours || 0; } };
  const inicio = (s) => new Date(s.startEntry?.timestamp);
  const validos = turnos.filter(s => !isNaN(inicio(s)));
  const mapa = new Map();

  if (rango?.modo === 'semana') {
    for (let i = 0; i < 7; i++) {
      const dia = new Date(rango.desde.getFullYear(), rango.desde.getMonth(), rango.desde.getDate() + i);
      const dd = formatWeekdayShort(dia);
      mapa.set(claveDia(dia), nuevo(claveDia(dia), `${capitalizar(dd)} ${dia.getDate()}`));
    }
    validos.forEach(s => sumar(mapa, claveDia(inicio(s)), s));
  } else if (rango?.modo === 'mes') {
    for (let d = inicioSemanaOperativa(rango.desde); d < rango.hasta; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      mapa.set(claveDia(d), nuevo(claveDia(d), corto(d)));
    }
    validos.forEach(s => sumar(mapa, claveDia(inicioSemanaOperativa(inicio(s))), s));
  } else if (rango?.modo === 'anio' || rango?.modo === 'todo') {
    let desde = rango.desde;
    let hasta = rango.hasta;
    if (rango.modo === 'todo') {
      if (validos.length === 0) return [];
      const tiempos = validos.map(s => inicio(s).getTime());
      const a = new Date(Math.min(...tiempos));
      const b = new Date(Math.max(...tiempos));
      desde = new Date(a.getFullYear(), a.getMonth(), 1);
      hasta = new Date(b.getFullYear(), b.getMonth() + 1, 1);
    }
    const variosAnios = desde.getFullYear() !== new Date(hasta.getFullYear(), hasta.getMonth() - 1, 1).getFullYear();
    for (let d = desde; d < hasta; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const mes = formatMonthShort(d);
      mapa.set(claveMes(d), nuevo(claveMes(d), variosAnios ? `${capitalizar(mes)} ${String(d.getFullYear()).slice(2)}` : capitalizar(mes)));
    }
    validos.forEach(s => sumar(mapa, claveMes(inicio(s)), s));
  }
  return tramos;
}
