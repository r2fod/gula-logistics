// Los festivos que caen en una semana del planning (de su martes a su lunes de cola) y,
// de cada uno, las tareas de ese día que son un recado a un proveedor o a un alquiler
// —recoger o devolver algo—, que ese día cierran. Para avisar en el Cuadrante y al
// aceptar un borrador; no cambia nada.
import { PREFIJO_ID, aIso, fechaLocal, idLibreDeTarea, sumarDias } from './fechasSemana';
import { diaHabilCercano, festivoEn, festivosLocales } from './festivos';
import { NOMBRE_DIA } from './disponibilidad';
import { buildTaskListPatch, esTareaActiva, getTaskListForDay, getTaskText, getWeekRange } from './taskPlanning';
import { plano } from '../utils/texto';

const DIAS = ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
// «Recoger sillas», «Devolver generador», «Devolución material»… pero no recoger el
// propio evento al terminar («Recogida y vuelta a base», «Recogida del evento»).
const ES_RECADO = /\b(devolver|devolucion|recoger|recogida)\b/;
const ES_DEL_EVENTO = /recogida (y vuelta a base|y descarga|del evento|evento|final|boda)|terminar de recoger|recoger (el )?evento/;
export function esRecadoAProveedor(texto) {
  const t = plano(texto);
  return ES_RECADO.test(t) && !ES_DEL_EVENTO.test(t);
}

// Una devolución se pasa al primer día que abren; una recogida, al último anterior (hay
// que tenerlo antes del evento).
const esDevolucion = (texto) => /\b(devolver|devolucion)\b/.test(plano(texto));
const etiquetaDe = (fechaIso) => {
  const fecha = fechaLocal(fechaIso);
  return `${NOMBRE_DIA[DIAS[(fecha.getDay() + 5) % 7]].toLowerCase()} ${fecha.getDate()}`;
};

// Las tareas de un día con su posición en la lista: domingo y lunes comparten lista
// (`targetDay`; sin él, lunes).
function tareasDelDia(semana, dia) {
  const lista = getTaskListForDay(semana, dia).map((tarea, indice) => ({ tarea, indice }));
  if (dia !== 'domingo' && dia !== 'lunes') return lista;
  return lista.filter(({ tarea }) => (/domingo/i.test(tarea?.targetDay || '') ? 'domingo' : 'lunes') === dia);
}

// [{ dia, fecha, nombre, local?, previsto?, etiqueta: 'Lunes 12', tareas: [textos],
//    recados: [{ texto, indice, destino: 'martes 13' }] }] — `indice`, el de su lista.
export function festivosDeLaSemana(semana, extras = festivosLocales(), ahora = new Date()) {
  const rango = getWeekRange(semana, ahora);
  if (!rango) return [];
  return DIAS.flatMap((dia, i) => {
    const fecha = sumarDias(rango.start, i);
    const festivo = festivoEn(aIso(fecha), extras);
    if (!festivo) return [];
    const recados = tareasDelDia(semana, dia)
      .filter(({ tarea }) => esTareaActiva(tarea) && !(tarea && typeof tarea === 'object' && tarea.completed))
      .map(({ tarea, indice }) => ({ completo: getTaskText(tarea), indice }))
      .filter(r => esRecadoAProveedor(r.completo))
      .map(({ completo, indice }) => ({
        texto: completo.replace(/^.*? - /, '').trim(),
        indice,
        destino: etiquetaDe(diaHabilCercano(aIso(fecha), esDevolucion(completo) ? 1 : -1, extras)),
      }));
    return [{ ...festivo, dia, etiqueta: `${NOMBRE_DIA[dia]} ${fecha.getDate()}`, tareas: recados.map(r => r.texto), recados }];
  });
}

// Pasa una recogida o una devolución puesta en festivo al día hábil que le toca (el
// `destino` de arriba), aunque caiga en otra semana (del lunes de cola al martes
// siguiente). Va al final de la lista de ese día con un id libre, sin marcar y con su
// gente y su horario. Devuelve { semanas (el mapa con las que cambian), destino,
// semana (nombre de la de destino) } o { error }.
export function pasarADiaHabil(semanas = {}, weekId, dia, indice, extras = festivosLocales(), ahora = new Date()) {
  const origen = semanas[weekId];
  const rango = getWeekRange(origen, ahora);
  const lista = getTaskListForDay(origen, dia);
  const tarea = lista[indice];
  if (!rango || tarea === undefined || !DIAS.includes(dia)) return { error: 'No se encuentra esa tarea: recarga y vuelve a intentarlo.' };
  if (dia === 'sabado') return { error: 'Las del sábado se mueven desde el editor del Planning.' };

  const texto = getTaskText(tarea);
  const fecha = aIso(sumarDias(rango.start, DIAS.indexOf(dia)));
  const nuevaFecha = diaHabilCercano(fecha, esDevolucion(texto) ? 1 : -1, extras);
  const destino = etiquetaDe(nuevaFecha);
  const [idDestino, semanaDestino] = Object.entries(semanas).find(([, s]) => {
    const r = getWeekRange(s, ahora);
    return r && nuevaFecha >= aIso(r.start) && nuevaFecha <= aIso(sumarDias(r.start, 6));
  }) || [];
  if (!semanaDestino) return { error: `No hay ninguna semana creada para el ${destino}: créala primero («+ Semana») y vuelve a pulsarlo.` };

  // Fuera de su día festivo…
  const sinElla = { ...origen, ...buildTaskListPatch(origen, dia, lista.filter((_, i) => i !== indice)) };
  // …y al final del día que abren.
  const base = idDestino === weekId ? sinElla : semanaDestino;
  const diaDestino = DIAS[(fechaLocal(nuevaFecha).getDay() + 5) % 7];
  const { id: _id, targetDay: _dia, completedAt: _hecha, reopened: _reabierta, ...resto } = typeof tarea === 'object' ? tarea : { text: tarea };
  const movida = { ...resto, completed: false };
  let conElla;
  if (diaDestino === 'sabado') {
    // El sábado es una lista de bodas: la tarea entra con esa forma.
    const bodas = base.saturdaySpecial?.weddings || [];
    conElla = { ...base, saturdaySpecial: { ...(base.saturdaySpecial || {}), weddings: [...bodas, { location: movida.location || 'Por confirmar', truck: movida.truck || '', details: texto, timeFrame: movida.timeFrame || '', mapsUrl: movida.mapsUrl || '', assigned: movida.assigned || [], event: movida.event || '', completed: false }] } };
  } else {
    const actual = getTaskListForDay(base, diaDestino);
    const esCola = diaDestino === 'domingo' || diaDestino === 'lunes';
    const nueva = { ...movida, id: idLibreDeTarea(actual, PREFIJO_ID[diaDestino]), ...(esCola ? { targetDay: NOMBRE_DIA[diaDestino] } : {}) };
    conElla = { ...base, ...buildTaskListPatch(base, diaDestino, [...actual, nueva]) };
  }
  return { semanas: { ...semanas, [weekId]: sinElla, [idDestino]: conElla }, destino, semana: semanaDestino.name || '' };
}

// Lo que conviene mirar por los festivos antes de aceptar la semana (textos; vacío = nada).
export function avisosDeFestivos(semana, extras = festivosLocales(), ahora = new Date()) {
  return festivosDeLaSemana(semana, extras, ahora)
    .filter(f => f.tareas.length)
    .map(f => `${f.etiqueta} es festivo (${f.nombre}) y los proveedores y alquileres cierran: revisa ${f.tareas.map(t => `«${t}»`).join(', ')}.`);
}

// La fecha ('AAAA-MM-DD') del día de la semana que se elige en la flota para un alquiler.
// El lunes de una recogida es el de la víspera (antes del martes); el de una devolución,
// el de la cola. null si la semana no tiene fechas legibles o el día no vale.
const DIA_DE_FLOTA = { Martes: 0, 'Miércoles': 1, Jueves: 2, Viernes: 3, 'Sábado': 4, Domingo: 5 };
export function fechaDeDiaDeFlota(semana, nombreDia, uso = 'recogida', ahora = new Date()) {
  const rango = getWeekRange(semana, ahora);
  const desplazamiento = nombreDia === 'Lunes' ? (uso === 'devolucion' ? 6 : -1) : DIA_DE_FLOTA[nombreDia];
  return rango && desplazamiento !== undefined ? aIso(sumarDias(rango.start, desplazamiento)) : null;
}
