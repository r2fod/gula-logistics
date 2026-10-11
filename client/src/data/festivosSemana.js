// Los festivos que caen en una semana del planning (de su martes a su lunes de cola) y,
// de cada uno, las tareas de ese día que son un recado a un proveedor o a un alquiler
// —recoger o devolver algo—, que ese día cierran. Para avisar en el Cuadrante y al
// aceptar un borrador; no cambia nada.
import { aIso, sumarDias } from './fechasSemana';
import { festivoEn, festivosLocales } from './festivos';
import { NOMBRE_DIA } from './disponibilidad';
import { esTareaActiva, getTaskListForDay, getTaskText, getWeekRange } from './taskPlanning';
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

// Las tareas de un día: domingo y lunes comparten lista (`targetDay`; sin él, lunes).
function tareasDelDia(semana, dia) {
  const lista = getTaskListForDay(semana, dia);
  if (dia !== 'domingo' && dia !== 'lunes') return lista;
  return lista.filter(t => (/domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes') === dia);
}

// [{ dia, fecha, nombre, local?, previsto?, etiqueta: 'Lunes 12', tareas: [textos] }]
export function festivosDeLaSemana(semana, extras = festivosLocales(), ahora = new Date()) {
  const rango = getWeekRange(semana, ahora);
  if (!rango) return [];
  return DIAS.flatMap((dia, i) => {
    const fecha = sumarDias(rango.start, i);
    const festivo = festivoEn(aIso(fecha), extras);
    if (!festivo) return [];
    const tareas = tareasDelDia(semana, dia)
      .filter(t => esTareaActiva(t) && !(t && typeof t === 'object' && t.completed))
      .map(t => getTaskText(t))
      .filter(esRecadoAProveedor)
      .map(texto => texto.replace(/^.*? - /, '').trim());
    return [{ ...festivo, dia, etiqueta: `${NOMBRE_DIA[dia]} ${fecha.getDate()}`, tareas }];
  });
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
