import { getWeekRange } from './taskPlanning';

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

const corto = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// { modo, desde, hasta, etiqueta }: `desde` incluido y `hasta` excluido; en
// "todo" ambos son null. `semanas` (el mapa de semanas del planning) solo sirve
// para poner el nombre ("Semana 3") a la semana que coincide.
export function rangoDePeriodo(modo, ancla = new Date(), semanas = {}) {
  if (modo === 'mes') {
    const desde = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const hasta = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1);
    return { modo, desde, hasta, etiqueta: capitalizar(desde.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })) };
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
