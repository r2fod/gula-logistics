// «Actualizar desde calendario» (Cuadrante): lo que el Calendario Gula tiene en la
// semana y el planning todavía no (eventos que se apuntaron después de crearla,
// producciones, cumpleaños…). Solo AÑADE: las tareas que ya hay no se tocan —ni su
// texto, que guarda el fichaje, ni su gente, ni su posición— y las nuevas se reparten
// con la gente ya asignada como ocupada (optimizadorPlanning.js). Funciones puras: la
// lectura del calendario y el guardado los hace quien llama.
import { eventosDelCalendario, generarBorrador } from './weekGenerator';
import { tareasDelPlanning } from './optimizadorPlanning';
import { limitesDe, restriccionesDe } from './disponibilidad';
import { getWeekRange } from './taskPlanning';
import { EVENT_CATEGORIES, parseEventAndTask } from './eventNaming';
import { PREFIJO_ID, aIso, fechaLocal, sumarDias } from './fechasSemana';
import { plano } from '../utils/texto';

const DIAS_LISTA = ['martes', 'miercoles', 'jueves', 'viernes'];
const JS_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const diaDe = (iso) => JS_DIA[fechaLocal(iso).getDay()];

// "Boda Ana y Luis" ≈ "Boda Ana" ≈ "Ana y Luis": sin el tipo delante y uno empieza por el otro.
const clave = (nombre) => plano(nombre).replace(/^(evento|boda|comunion|cumpleanos|produccion)\s+/, '').replace(/[?¿]/g, '').trim();
export function mismoEvento(a, b) {
  const x = clave(a);
  const y = clave(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x)));
}

// Eventos que ya salen en la semana: [{ nombre, dia }] (de `event`, del texto
// "EVENTO - Tarea" y de week.events, sin día). Las tareas desactivadas también cuentan.
function eventosEnSemana(semana) {
  const vistos = [];
  const anotar = (nombre, dia) => String(nombre || '').split(/\s+\+\s+/).forEach(n => {
    if (n.trim() && !EVENT_CATEGORIES.includes(n.trim())) vistos.push({ nombre: n.trim(), dia });
  });
  const deTarea = (t) => {
    if (!t || typeof t !== 'object') return '';
    if (t.event) return t.event;
    const p = parseEventAndTask(t.text);
    return p.explicit ? p.eventName : '';
  };
  DIAS_LISTA.forEach(d => (semana?.schedule?.[d]?.tasks || []).forEach(t => anotar(deTarea(t), d)));
  (semana?.saturdaySpecial?.weddings || []).forEach(b => anotar(b?.event || String(b?.details || '').split(/\s+[—–]\s+/)[0], 'sabado'));
  (semana?.sundayMonday?.tasks || []).forEach(t => anotar(deTarea(t), /domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes'));
  (semana?.events || []).forEach(e => anotar(e?.name, null));
  return vistos;
}

// Lo que falta: { faltan: [{ nombre, tipo, fechas, pax, hora, sitio, tareas: [{ clave, lista, dia, tarea }] }], avisos }
// o { error }. Una producción se mira día a día (cada día de rodaje es un servicio).
export function eventosQueFaltan(semana, apuntes = [], { equipo = [], ahora = new Date() } = {}) {
  const rango = getWeekRange(semana, ahora);
  if (!rango) return { error: 'No se pueden leer las fechas de la semana (meta.dateRange).' };
  const inicio = rango.start;
  const vistos = eventosEnSemana(semana);
  const faltan = eventosDelCalendario(apuntes, inicio, sumarDias(inicio, 5)).filter(e => !vistos.some(v =>
    mismoEvento(v.nombre, e.nombre) && (e.tipo !== 'produccion' || v.dia === null || v.dia === diaDe(e.fecha))
  ));
  if (!faltan.length) return { faltan: [], avisos: [] };

  // Sus tareas, como en el borrador, pero solo de lo que falta y con la gente ya
  // asignada en la semana como ocupada.
  const soloLoQueFalta = [
    ...faltan.map((e, i) => ({ id: `falta${i}`, fecha: e.fecha, tipo: e.tipo, titulo: e.nombre, pax: e.pax, hora: e.hora, sitio: e.sitio })),
    ...apuntes.filter(a => a?.tipo === 'vacaciones'),
  ];
  const fijas = tareasDelPlanning(semana).map(t => ({ clave: t.clave, dia: t.dia, ini: t.ini, fin: t.fin, personas: t.asignados }));
  const { week, resumen } = generarBorrador({
    inicio, apuntes: soloLoQueFalta, roster: equipo, plantilla: { trucks: semana?.trucks || [] }, ahora,
    restricciones: restriccionesDe(semana), limites: limitesDe(semana), fijas,
  });
  const generadas = [
    ...DIAS_LISTA.flatMap(d => week.schedule[d].tasks.map(t => ({ lista: d, dia: d, tarea: t }))),
    ...week.saturdaySpecial.weddings.map(b => ({ lista: 'sabado', dia: 'sabado', tarea: b })),
    ...week.sundayMonday.tasks.map(t => ({ lista: 'cola', dia: t.targetDay === 'Domingo' ? 'domingo' : 'lunes', tarea: t })),
  ].map((g, i) => ({ ...g, clave: `n${i}` }));

  // Agrupadas por evento (una producción de varios días, una sola fila). La limpieza
  // de un evento de diario ("Limpieza Eventos - … (Faro)") va con su evento.
  const grupos = [];
  faltan.forEach(e => {
    let g = grupos.find(x => x.nombre === e.nombre);
    if (!g) grupos.push(g = { nombre: e.nombre, tipo: e.tipo, fechas: [], pax: e.pax, hora: e.hora, sitio: e.sitio, tareas: [] });
    g.fechas.push(e.fecha);
  });
  grupos.forEach(g => {
    const corto = plano(g.nombre.replace(/^(Evento|Boda|Comunión)\s+/i, ''));
    g.tareas = generadas.filter(x => x.tarea.event === g.nombre
      || (x.tarea.event === 'Limpieza Eventos' && corto && plano(x.tarea.text || '').includes(`(${corto}`)));
  });
  // Solo los avisos de lo que se propone (no los de las tareas generales que se dejan fuera).
  const nombres = grupos.map(g => plano(g.nombre));
  return { faltan: grupos, avisos: resumen.avisos.filter(a => nombres.some(n => plano(a).includes(n))) };
}

// La semana con las tareas elegidas ([{ lista, tarea }] de eventosQueFaltan) añadidas al
// FINAL de su lista (los fichajes guardan la posición de las que ya había) con un id
// libre de su día, y el pax de los eventos nuevos en week.events.
export function anadirAlPlanning(semana, elegidas = [], eventos = []) {
  const nueva = JSON.parse(JSON.stringify(semana || {}));
  const idLibre = (lista, prefijo) => {
    const usados = new Set(lista.map(t => String(t?.id || '')));
    let n = lista.length + 1;
    while (usados.has(`${prefijo}${n}`)) n += 1;
    return `${prefijo}${n}`;
  };
  elegidas.forEach(({ lista, tarea }) => {
    if (lista === 'sabado') {
      nueva.saturdaySpecial = nueva.saturdaySpecial || { title: '', weddings: [] };
      nueva.saturdaySpecial.weddings = [...(nueva.saturdaySpecial.weddings || []), { ...tarea }];
      return;
    }
    if (lista === 'cola') {
      nueva.sundayMonday = nueva.sundayMonday || { title: '', tasks: [] };
      const tareas = nueva.sundayMonday.tasks || [];
      nueva.sundayMonday.tasks = [...tareas, { ...tarea, id: idLibre(tareas, 'sl') }];
      return;
    }
    nueva.schedule = nueva.schedule || {};
    const dia = nueva.schedule[lista] || { title: '', badge: '', tasks: [] };
    const tareas = dia.tasks || [];
    nueva.schedule[lista] = { ...dia, tasks: [...tareas, { ...tarea, id: idLibre(tareas, PREFIJO_ID[lista]) }] };
  });
  const conPax = eventos.filter(e => e.pax && !(nueva.events || []).some(x => mismoEvento(x?.name, e.nombre)));
  if (conPax.length) nueva.events = [...(nueva.events || []), ...conPax.map(e => ({ name: e.nombre, pax: e.pax }))];
  return nueva;
}

// Martes a lunes (la cola) de la semana para pedir el calendario: { desde, hasta } (AAAA-MM-DD) o null.
export function fechasParaCalendario(semana, ahora = new Date()) {
  const rango = getWeekRange(semana, ahora);
  return rango ? { desde: aIso(rango.start), hasta: aIso(sumarDias(rango.start, 6)) } : null;
}
