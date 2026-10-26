import { eventosDelTrozo, summarizeByEvent } from './eventSummary';
import { listarTareasPlanificadas } from './repartoPorPlanning';
import { parseEventAndTask } from './eventNaming';
import { mismoNombre } from './nombresTrabajadores';
import { plano } from '../utils/texto';
import { mismoDia } from '../utils/dateUtils';

// Informe de horas y coste del personal de uno o varios eventos: lo que se descarga en
// Excel desde el Resumen financiero (excelEventos.js). Es el MISMO reparto que el desglose
// por evento (summarizeByEvent sobre los turnos con el tiempo sin tarea ya repartido),
// hecho turno a turno para saber de cada persona su entrada, su salida y qué parte de ese
// turno fue para el evento: los totales del Excel son los de la pantalla.
//
// `turnos`: los del periodo, ya repartidos (repartirTiempoSinTarea).
// → [{ evento, pax, horas, coste, filas, sinFichar }] en el orden de `eventos`:
//   filas: [{ nombre, rol, nomina, inicio, fin, horasTurno, horas, tarifa, coste, tareas,
//            estimado, compartido, otroDia, bolsa }] — `tarifa` es la que da `coste` (con
//            bolsa de horas, la media del turno: parte a la de bolsa y parte a la extra)
//   sinFichar: [{ nombre, rol, inicio, fin, tarea }] — en el planning del evento y sin
//            ningún turno ese día (no suman: se ven para completarlos a mano).

const seSolapan = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const tareaCorta = (texto) => parseEventAndTask(texto).specificTaskName || String(texto || '').trim();

export function informeDeEventos({ eventos = [], turnos = [], equipo = [], paxByEvent = {}, resolveEvent = null, semanas = {}, ahora = new Date() } = {}) {
  const ficha = (nombre) => equipo.find(w => mismoNombre(w.name, nombre)) || null;
  const planificadas = listarTareasPlanificadas(semanas, ahora);
  // El reparto de cada turno entre eventos, una sola vez para todos los eventos pedidos.
  const repartos = turnos.map(s => ({ s, porEvento: summarizeByEvent([s], equipo, paxByEvent, resolveEvent) }));

  return eventos.map(evento => {
    const clave = plano(evento);
    const delEvento = (nombres) => nombres.some(n => plano(n) === clave);

    const filas = repartos.flatMap(({ s, porEvento }) => {
      const suyo = porEvento.find(e => plano(e.eventName) === clave);
      if (!suyo || suyo.totalHours <= 0.0001) return [];
      const inicio = new Date(s.startEntry?.timestamp);
      const fin = new Date(s.endEntry?.timestamp);
      const trozos = (s.subTasks || []).filter(st => delEvento(eventosDelTrozo(st, resolveEvent).eventNames));
      const tareas = [...new Set(trozos.map(st => tareaCorta(st.tareaPlanificada?.texto || st.taskName)).filter(Boolean))];
      const planificados = trozos.map(st => st.tareaPlanificada).filter(Boolean);
      const persona = ficha(s.workerName);
      const bolsa = !!s.conBolsa; // aplicarTarifaDeBolsa (ya cambió `rate` por la media)
      return [{
        nombre: persona?.name || s.workerName,
        rol: persona?.role || '',
        nomina: !!(persona?.isPayroll ?? s.isSalaried),
        inicio, fin,
        horasTurno: s.durationHours,
        horas: suyo.totalHours,
        tarifa: bolsa ? suyo.totalCost / suyo.totalHours : s.rate,
        coste: suyo.totalCost,
        bolsa,
        tareas,
        estimado: suyo.horasEstimadas > 0.0001,
        compartido: porEvento.length > 1,
        // Repartido con tareas suyas de OTRO día de la semana (ese día no tenía ninguna).
        otroDia: planificados.length > 0 && !planificados.some(t => mismoDia(t.inicio, inicio) || seSolapan(t.inicio, t.fin, inicio, fin)),
      }];
    }).sort((a, b) => a.inicio - b.inicio || a.nombre.localeCompare(b.nombre));

    const sinFichar = planificadas
      .filter(t => t.evento && delEvento(eventosDelTrozo({ eventoPlanificado: t.evento }).eventNames))
      .flatMap(t => t.nombresAsignados
        .filter(nombre => !turnos.some(s => mismoNombre(s.workerName, nombre) && (
          seSolapan(t.inicio, t.fin, new Date(s.startEntry?.timestamp), new Date(s.endEntry?.timestamp))
          || mismoDia(t.inicio, new Date(s.startEntry?.timestamp)))))
        .map(nombre => ({ nombre: ficha(nombre)?.name || nombre, rol: ficha(nombre)?.role || '', inicio: t.inicio, fin: t.fin, tarea: tareaCorta(t.texto) })))
      .sort((a, b) => a.inicio - b.inicio || a.nombre.localeCompare(b.nombre));

    return {
      evento,
      pax: paxByEvent[String(evento).toLowerCase()] || null, // buildPaxRegistry: en minúsculas, con tildes
      horas: filas.reduce((suma, f) => suma + f.horas, 0),
      coste: filas.reduce((suma, f) => suma + f.coste, 0),
      filas,
      sinFichar,
    };
  });
}
