import { listarTareasPlanificadas } from './repartoPorPlanning';
import { normalizarEtiquetaTarea, parseEventAndTask } from './eventNaming';
import { plano } from '../utils/texto';

// Lo que el asistente APRENDE de los fichajes reales, sin que nadie escriba nada:
//   · cuánto duran de verdad los tipos de tarea frente a lo planificado (solo
//     tramos fichados sobre una tarea concreta del planning, enlazados por su
//     texto igual que el reparto de costes, y LIMPIOS: mucha gente ficha la
//     primera tarea y no cambia hasta la salida, así que un turno que se solapa
//     con otra tarea planificada de esa persona no mide esa tarea — en los datos
//     reales, "cargas" de 1 h 40 salían de 6 h), y
//   · quién suele hacer cada tipo de tarea (horas fichadas por persona).
// Se usa en el prompt de Gemini (textoAprendizajeParaPrompt) y en el panel
// "Memoria IA". Antes se miraba la hora en que alguien pulsaba "hecha", que
// casi nunca coincide con cuando se acabó la tarea.


export const TIPOS_TAREA = ['Carga', 'Descarga y montaje', 'Recogida y devolución', 'Servicio de boda', 'Limpieza', 'Preparación', 'Otras'];

// Tipo de una tarea por su texto (la parte de la tarea, no la del evento:
// "Boda Ana - Carga camión" es una carga).
export function tipoDeTarea(texto) {
  const completo = plano(texto);
  if (/^boda:/.test(completo.trim())) return 'Servicio de boda'; // fichaje de boda del sábado
  const partes = parseEventAndTask(texto);
  const t = plano(partes.explicit ? partes.specificTaskName : texto);
  if (/limpieza|vajilla|higieniz|friega/.test(t)) return 'Limpieza';
  if (/descarg|montaje|montar|desmont/.test(t)) return 'Descarga y montaje';
  if (/\bcarg(a|as|ar|ado|ados|ando|amos|ue|uen)?\b|estiba/.test(t)) return 'Carga';
  if (/recog|devoluc|devolver|entreg/.test(t)) return 'Recogida y devolución';
  if (/servicio|boda|evento|banquete|catering/.test(t)) return 'Servicio de boda';
  if (/prepar|checklist|supervis|organiz|albaran|inventari/.test(t)) return 'Preparación';
  return 'Otras';
}

const MAX_MIN_TRAMO = 16 * 60; // más es casi seguro un olvido de fichar salida
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// { porTipo: [{ tipo, tareas, planificadoMin, realMin, desvioMin }] (más tareas primero; solo tramos limpios),
//   porPersona: { nombre: { tipo: horas } }, enlazados (con su tarea), sinEnlazar }
// `turnos` son los de pairShiftsFromEntries; `semanas`, el mapa de semanas.
export function aprenderDeFichajes(turnos = [], semanas = {}, ahora = new Date()) {
  const tareas = listarTareasPlanificadas(semanas, ahora, { incluirSinEvento: true });
  const porEtiqueta = new Map();
  tareas.forEach(t => {
    const clave = normalizarEtiquetaTarea(t.texto);
    if (!porEtiqueta.has(clave)) porEtiqueta.set(clave, []);
    porEtiqueta.get(clave).push(t);
  });

  const muestras = {}; // tipo -> [{ plan, real }]
  const porPersona = {};
  let enlazados = 0;
  let sinEnlazar = 0;

  turnos.forEach(turno => {
    if (turno.isAnomalous) return;
    const inicioTurno = new Date(turno.startEntry?.timestamp);
    const finTurno = new Date(turno.endEntry?.timestamp);
    if (Number.isNaN(inicioTurno.getTime())) return;
    // Jornada con tramos (se ficha cada tarea al cambiar): cada tramo es de su tarea.
    const porTramos = turno.startEntry?.taskName === 'JORNADA';
    const persona = plano(turno.workerName).trim();
    const otrasTareasEnElTurno = (propia) => tareas.some(t => t !== propia && t.asignados.includes(persona)
      && t.inicio < finTurno && t.fin > inicioTurno);
    (turno.subTasks || []).forEach(tramo => {
      // El tiempo de "jornada" sin tarea no dice nada de ninguna tarea.
      const etiqueta = normalizarEtiquetaTarea(tramo.taskName || '');
      if (!etiqueta || (/jornada|sin asignar/.test(etiqueta) && !porEtiqueta.has(etiqueta))) return;
      const realMin = (tramo.durationHours || 0) * 60;
      if (realMin <= 0 || realMin > MAX_MIN_TRAMO) return;

      // La tarea del planning con ese texto en la semana del turno (si se repite
      // el texto, la que empieza más cerca de cuando se fichó).
      const candidatas = (porEtiqueta.get(etiqueta) || [])
        .filter(t => inicioTurno >= t.semanaDesde && inicioTurno < t.semanaHasta);
      const tarea = candidatas.sort((a, b) => Math.abs(a.inicio - inicioTurno) - Math.abs(b.inicio - inicioTurno))[0];

      const tipo = tipoDeTarea(tarea ? tarea.texto : tramo.taskName);
      porPersona[turno.workerName] = porPersona[turno.workerName] || {};
      porPersona[turno.workerName][tipo] = (porPersona[turno.workerName][tipo] || 0) + realMin / 60;

      if (!tarea) { sinEnlazar += 1; return; }
      enlazados += 1;
      const planMin = (tarea.fin - tarea.inicio) / 60000;
      if (planMin <= 0 || (!porTramos && otrasTareasEnElTurno(tarea))) return;
      (muestras[tipo] = muestras[tipo] || []).push({ plan: planMin, real: realMin });
    });
  });

  const porTipo = Object.entries(muestras).map(([tipo, xs]) => {
    const planificadoMin = Math.round(media(xs.map(x => x.plan)));
    const realMin = Math.round(media(xs.map(x => x.real)));
    return { tipo, tareas: xs.length, planificadoMin, realMin, desvioMin: realMin - planificadoMin };
  }).sort((a, b) => b.tareas - a.tareas);

  return { porTipo, porPersona, enlazados, sinEnlazar };
}

// Umbrales para que un patrón llegue a Gemini: bastantes tareas y un desvío que importe.
export const MIN_TAREAS_PATRON = 3;
export const MIN_DESVIO_MIN = 10;
export const MIN_HORAS_PERSONA = 2;

export const formatearMinutos = (min) => {
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const texto = h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`;
  return min < 0 ? `-${texto}` : texto;
};

// Quién hace más horas de cada tipo: { tipo: [{ nombre, horas }] } (de más a menos).
export function personasPorTipo(porPersona = {}, minHoras = MIN_HORAS_PERSONA) {
  const out = {};
  Object.entries(porPersona).forEach(([nombre, tipos]) => {
    Object.entries(tipos).forEach(([tipo, horas]) => {
      if (horas < minHoras || tipo === 'Otras') return;
      (out[tipo] = out[tipo] || []).push({ nombre, horas: Math.round(horas * 10) / 10 });
    });
  });
  Object.values(out).forEach(lista => lista.sort((a, b) => b.horas - a.horas));
  return out;
}

// Bloque del prompt de Gemini ('' si aún no hay nada que merezca la pena).
// `cabecera`: la del prompt completo por defecto; el compacto (editorIa.js) pone la suya.
export function textoAprendizajeParaPrompt(aprendizaje, cabecera = '\n10. APRENDIZAJE DE LOS FICHAJES REALES (datos de semanas pasadas, no suposiciones):') {
  if (!aprendizaje) return '';
  const duraciones = (aprendizaje.porTipo || [])
    .filter(t => t.tipo !== 'Otras' && t.tareas >= MIN_TAREAS_PATRON && Math.abs(t.desvioMin) >= MIN_DESVIO_MIN)
    .map(t => `- ${t.tipo}: planificadas ${formatearMinutos(t.planificadoMin)} de media, reales ${formatearMinutos(t.realMin)} (${t.desvioMin > 0 ? '+' : ''}${formatearMinutos(t.desvioMin)}, ${t.tareas} tareas).`);
  const quien = Object.entries(personasPorTipo(aprendizaje.porPersona))
    .map(([tipo, lista]) => `- ${tipo}: ${lista.slice(0, 3).map(p => `${p.nombre} (${p.horas} h)`).join(', ')}.`);
  if (!duraciones.length && !quien.length) return '';
  const partes = [cabecera];
  if (duraciones.length) partes.push('Duración real frente a la planificada por tipo de tarea:', ...duraciones, 'Usa estas duraciones reales al poner los horarios (timeFrame) de las tareas de ese tipo.');
  if (quien.length) partes.push('Quién suele hacer cada tipo de tarea (horas fichadas):', ...quien, 'Tenlo en cuenta al asignar, siempre que no contradiga las reglas anteriores.');
  return partes.join('\n');
}
