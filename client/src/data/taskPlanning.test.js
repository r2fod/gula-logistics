import { describe, it, expect } from 'vitest';
import {
  getTaskListForDay, resolveTaskIndexByText, buildTaskListPatch, isTaskChronologicallyPast, isTaskTooEarlyToClockIn,
  parseWeekRange, resolveTaskDate, resolveTaskEvalDay, getTaskPastStatus, isTaskPast, ensureYearInDateRange, clearWeekCompletion, getDayLabel, getWeddingsBadge, getTaskStartDateTime, getNextTaskStart, isTaskTooEarlyToStart, isTaskEffectivelyDone,
} from './taskPlanning';

const weekData = {
  schedule: {
    martes: { tasks: [{ text: 'Cargar furgoneta', completed: false }, 'Recoger sillas'] },
  },
  sundayMonday: {
    title: 'Domingo 20 & Lunes 21',
    tasks: [{ text: 'Devolver Dealde', completed: false }, { text: 'Recogida en Refranys', completed: true }],
  },
};

describe('getTaskListForDay', () => {
  it('para "domingo" devuelve sundayMonday.tasks, no schedule.domingo (que no existe)', () => {
    expect(getTaskListForDay(weekData, 'domingo')).toBe(weekData.sundayMonday.tasks);
  });

  it('para un día normal devuelve schedule[dayKey].tasks', () => {
    expect(getTaskListForDay(weekData, 'martes')).toBe(weekData.schedule.martes.tasks);
  });

  it('devuelve [] si el día no existe en el planning, sin lanzar', () => {
    expect(getTaskListForDay(weekData, 'miercoles')).toEqual([]);
    expect(getTaskListForDay(null, 'martes')).toEqual([]);
  });

  it('"sundayMonday" es alias de "domingo" (es el nombre real del campo en Mongo, usado por AdminTaskEditorModal)', () => {
    expect(getTaskListForDay(weekData, 'sundayMonday')).toBe(weekData.sundayMonday.tasks);
  });
});

describe('resolveTaskIndexByText', () => {
  it('encuentra el índice real de una tarea de domingo por su texto', () => {
    expect(resolveTaskIndexByText(weekData, 'domingo', 'Recogida en Refranys')).toBe(1);
  });

  it('encuentra el índice de una tarea de texto plano (no objeto) en un día normal', () => {
    expect(resolveTaskIndexByText(weekData, 'martes', 'Recoger sillas')).toBe(1);
  });

  it('devuelve null si el texto no coincide con ninguna tarea', () => {
    expect(resolveTaskIndexByText(weekData, 'martes', 'Tarea inexistente')).toBeNull();
  });
});

describe('buildTaskListPatch', () => {
  it('para domingo, actualiza sundayMonday.tasks preservando el resto de sundayMonday (p.ej. title)', () => {
    const nuevaLista = [{ text: 'Devolver Dealde', completed: true }];
    const patch = buildTaskListPatch(weekData, 'domingo', nuevaLista);
    expect(patch).toEqual({ sundayMonday: { title: 'Domingo 20 & Lunes 21', tasks: nuevaLista } });
  });

  it('para un día normal, actualiza solo schedule[dayKey].tasks sin tocar otros días', () => {
    const nuevaLista = [{ text: 'Cargar furgoneta', completed: true }];
    const patch = buildTaskListPatch(weekData, 'martes', nuevaLista);
    expect(patch.schedule.martes.tasks).toEqual(nuevaLista);
    // No debe perder otros días que pudiera haber en schedule (aquí solo hay martes, pero la key debe conservarse).
    expect(Object.keys(patch.schedule)).toEqual(['martes']);
  });

  it('"sundayMonday" como dayKey también actualiza sundayMonday.tasks (mismo alias que "domingo")', () => {
    const nuevaLista = [{ text: 'Devolver Dealde', completed: true }];
    const patch = buildTaskListPatch(weekData, 'sundayMonday', nuevaLista);
    expect(patch).toEqual({ sundayMonday: { title: 'Domingo 20 & Lunes 21', tasks: nuevaLista } });
  });
});

// Sábado 19/09/2026 y domingo 20/09/2026 (fechas reales de este caso).
describe('isTaskChronologicallyPast', () => {
  it('sin margen (comportamiento de siempre): pasada en cuanto se supera la hora exacta', () => {
    const horaFin = new Date(2026, 8, 19, 23, 39); // 9min después de las 23:30
    expect(isTaskChronologicallyPast('sabado', '20:00-23:30', horaFin)).toBe(true);
  });

  it('con margen: NO se da por pasada todavía a los 9min de retraso (caso real de Johan)', () => {
    const horaFin = new Date(2026, 8, 19, 23, 39);
    expect(isTaskChronologicallyPast('sabado', '20:00-23:30', horaFin, 45)).toBe(false);
  });

  it('con margen: SÍ se da por pasada una vez superado el margen (mismo día)', () => {
    const masTarde = new Date(2026, 8, 19, 23, 30 + 46); // 46min después de las 23:30
    expect(isTaskChronologicallyPast('sabado', '20:00-23:30', masTarde, 45)).toBe(true);
  });

  it('turno que cruza medianoche: sigue "en curso" pasada la medianoche si no se ha superado su hora real de fin + margen (caso real de Gonzalo)', () => {
    // Boda 20:30-00:30 del sábado, comprobada el domingo a las 00:35 —
    // solo 5min después de las 00:30 reales, muy por debajo del margen de 45.
    const domingo0035 = new Date(2026, 8, 20, 0, 35);
    expect(isTaskChronologicallyPast('sabado', '20:30-00:30', domingo0035, 45)).toBe(false);
  });

  it('turno que cruza medianoche: sí se da por pasada una vez superado el margen tras su hora real de fin', () => {
    const masTarde = new Date(2026, 8, 20, 1, 22); // domingo 01:22 = 52min después de las 00:30 reales
    expect(isTaskChronologicallyPast('sabado', '20:30-00:30', masTarde, 45)).toBe(true);
  });

  it('dos o más días atrás: pasada sin ambigüedad, con o sin margen', () => {
    const jueves = new Date(2026, 8, 24); // jueves, con 'martes' como dayKey (2+ días atrás)
    expect(isTaskChronologicallyPast('martes', '09:00-16:00', jueves, 45)).toBe(true);
  });

  it('día futuro: nunca pasada, con o sin margen', () => {
    const martes = new Date(2026, 8, 15); // martes, con 'viernes' como dayKey (día futuro)
    expect(isTaskChronologicallyPast('viernes', '09:00-16:00', martes, 45)).toBe(false);
  });

  it('BUG real reproducido en producción: una tarea normal de tarde del MISMO día, comprobada de madrugada, NO debe darse por pasada', () => {
    // Domingo 20, tarea "15:00-17:00" (sin cruzar medianoche), comprobada a
    // las 02:00 del propio domingo — autoCompletePastTasks la marcó como
    // completada en Mongo esa madrugada sin haber llegado siquiera su hora
    // de inicio. Causa: la condición de "hora de madrugada" se aplicaba a
    // cualquier tarea, no solo a las que de verdad cruzan medianoche.
    const domingo0200 = new Date(2026, 8, 20, 2, 0);
    expect(isTaskChronologicallyPast('domingo', '15:00-17:00', domingo0200, 45)).toBe(false);
    expect(isTaskChronologicallyPast('domingo', '15:00-17:00', domingo0200)).toBe(false); // también sin margen
  });

  it('una tarea de madrugada de verdad (que SÍ cruza medianoche) sigue detectándose bien en el mismo día', () => {
    // Por si el fix de arriba rompiera el caso legítimo: una tarea
    // "22:00-02:00" comprobada a la 01:00 del mismo día sigue en curso.
    const mismoDia0100 = new Date(2026, 8, 20, 1, 0);
    expect(isTaskChronologicallyPast('domingo', '22:00-02:00', mismoDia0100)).toBe(false); // 01:00 < 02:00, en curso
    const mismoDia0230 = new Date(2026, 8, 20, 2, 30);
    expect(isTaskChronologicallyPast('domingo', '22:00-02:00', mismoDia0230)).toBe(true); // 02:30 > 02:00, pasada
  });

  it('BUG real (20/09): boda de domingo que cruza medianoche, comprobada ya el LUNES, debe seguir "en curso" hasta pasado su margen', () => {
    // 'domingo' es el último elemento de weekDayOrder (ordinal más alto),
    // así que domingo->lunes es el único par del ciclo semanal donde el
    // día de la tarea tiene un ordinal MAYOR que el de "hoy" sin ser en
    // realidad un día futuro — justo el caso que se saltaba el fix del
    // sábado->domingo (ordinales 5 y 6, sin ese problema de límite).
    const lunes0035 = new Date(2026, 8, 21, 0, 35); // lunes 21, 5min tras las 00:30 reales
    expect(isTaskChronologicallyPast('domingo', '20:30-00:30', lunes0035, 45)).toBe(false);
  });

  it('BUG real (20/09): esa misma boda de domingo SÍ se da por pasada una vez superado el margen, ya en lunes', () => {
    const lunes0122 = new Date(2026, 8, 21, 1, 22); // lunes 21, 52min tras las 00:30 reales
    expect(isTaskChronologicallyPast('domingo', '20:30-00:30', lunes0122, 45)).toBe(true);
  });

  it('BUG real (20/09): tarea de domingo SIN cruzar medianoche, comprobada ya el lunes por la tarde, sí se da por pasada (2+ días de margen de sobra)', () => {
    // Antes del fix esto devolvía false para siempre (se trataba como "día
    // futuro"): una tarea 15:00-17:00 del domingo, vista el lunes a las
    // 14:00, lleva casi 21h pasada su hora de fin, muy por encima de
    // cualquier margen razonable.
    const lunesTarde = new Date(2026, 8, 21, 14, 0);
    expect(isTaskChronologicallyPast('domingo', '15:00-17:00', lunesTarde, 45)).toBe(true);
  });

  it('sabado->domingo (el caso ya cubierto arriba) sigue funcionando igual tras el fix', () => {
    const domingo0035 = new Date(2026, 8, 20, 0, 35);
    expect(isTaskChronologicallyPast('sabado', '20:30-00:30', domingo0035, 45)).toBe(false);
    const masTarde = new Date(2026, 8, 20, 1, 22);
    expect(isTaskChronologicallyPast('sabado', '20:30-00:30', masTarde, 45)).toBe(true);
  });
});

describe('isTaskTooEarlyToClockIn', () => {
  it('bloquea si faltan más de 5min para la hora de inicio (mismo día)', () => {
    const now = new Date(2026, 8, 20, 8, 0); // domingo 08:00
    expect(isTaskTooEarlyToClockIn('domingo', '09:00-10:00', now)).toBe(true); // faltan 60min
  });

  it('permite fichar dentro del margen de 5min antes', () => {
    const now = new Date(2026, 8, 20, 8, 56); // faltan 4min
    expect(isTaskTooEarlyToClockIn('domingo', '09:00-10:00', now)).toBe(false);
  });

  it('permite fichar una vez llegada la hora (o pasada)', () => {
    const now = new Date(2026, 8, 20, 9, 0);
    expect(isTaskTooEarlyToClockIn('domingo', '09:00-10:00', now)).toBe(false);
  });

  it('BUG real: no debe aplicar la hora de una tarea de un día FUTURO sobre el reloj de hoy', () => {
    // La tarea "inmediata" (primera pendiente de la semana) es del jueves,
    // pero hoy es domingo — antes, el cálculo casero de WorkerView.jsx
    // ponía la hora de esa tarea sobre la fecha de HOY sin comprobar el
    // día, así que una tarea de jueves a las 09:00 parecía "ya pasada" un
    // domingo por la tarde y dejaba iniciar jornada antes de tiempo.
    const domingoTarde = new Date(2026, 8, 20, 18, 0);
    expect(isTaskTooEarlyToClockIn('jueves', '09:00-10:00', domingoTarde)).toBe(false); // jueves no es "hoy" -> no se evalúa por hora
  });

  it('sin horario registrado, no bloquea (no se puede evaluar)', () => {
    const now = new Date(2026, 8, 20, 8, 0);
    expect(isTaskTooEarlyToClockIn('domingo', null, now)).toBe(false);
    expect(isTaskTooEarlyToClockIn('domingo', '', now)).toBe(false);
  });

  it('un día distinto a hoy (pasado) no se bloquea por hora', () => {
    const lunesSiguiente = new Date(2026, 8, 21, 6, 0); // lunes 06:00
    expect(isTaskTooEarlyToClockIn('domingo', '09:00-10:00', lunesSiguiente)).toBe(false); // domingo ya no es "hoy"
  });
});

// Semana real de producción: martes 15 -> domingo 20 (+ lunes 21 de cola).
const semana = (dateRange) => ({ meta: { dateRange } });
const SEMANA_ACTUAL = semana('Del 15 al 20 de Septiembre de 2026');
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('parseWeekRange', () => {
  const now = at(2026, 9, 20, 20, 17);
  const ymd = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  it('lee "Del 15 al 20 de Septiembre de 2026"', () => {
    const r = parseWeekRange('Del 15 al 20 de Septiembre de 2026', now);
    expect([ymd(r.start), ymd(r.end)]).toEqual(['2026-9-15', '2026-9-20']);
  });

  it('sin año elige el más cercano a hoy (el placeholder del asistente no lleva año)', () => {
    const r = parseWeekRange('Del 22 al 27 de Septiembre', now);
    expect([ymd(r.start), ymd(r.end)]).toEqual(['2026-9-22', '2026-9-27']);
  });

  it('rango que cruza de mes: "Del 29 de Septiembre al 4 de Octubre"', () => {
    const r = parseWeekRange('Del 29 de Septiembre al 4 de Octubre', now);
    expect([ymd(r.start), ymd(r.end)]).toEqual(['2026-9-29', '2026-10-4']);
  });

  it('rango que cruza de AÑO con año explícito: el año es el del final', () => {
    const r = parseWeekRange('Del 29 de Diciembre al 3 de Enero de 2027', now);
    expect([ymd(r.start), ymd(r.end)]).toEqual(['2026-12-29', '2027-1-3']);
  });

  it('devuelve null (no inventa fechas) con texto ilegible o rangos absurdos', () => {
    expect(parseWeekRange('Fechas generadas por Asistente Gemini AI', now)).toBeNull();
    expect(parseWeekRange('Sin datos cargados todavía', now)).toBeNull();
    expect(parseWeekRange('Semana 4, del 22 al 27 de Septiembre', now)).toBeNull(); // 4 se lee como día
    expect(parseWeekRange('Del 1 al 30 de Septiembre', now)).toBeNull(); // 29 días: no es una semana
    expect(parseWeekRange(undefined, now)).toBeNull();
  });
});

describe('resolveTaskDate', () => {
  const range = parseWeekRange('Del 15 al 20 de Septiembre de 2026', at(2026, 9, 20));
  const dia = (k) => resolveTaskDate(range, k).getDate();

  it('martes 15 ... sábado 19, domingo 20 y el lunes 21 de cola', () => {
    expect(['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'].map(dia)).toEqual([15, 16, 17, 18, 19, 20, 21]);
  });
});

describe('resolveTaskEvalDay', () => {
  it('días normales y sábado: el propio dayKey', () => {
    expect(resolveTaskEvalDay('martes', { text: 'x' })).toBe('martes');
    expect(resolveTaskEvalDay('sabado', { location: 'Finca' })).toBe('sabado');
  });

  it('lista compartida con targetDay: manda el targetDay', () => {
    expect(resolveTaskEvalDay('domingo', { targetDay: 'Domingo' })).toBe('domingo');
    expect(resolveTaskEvalDay('domingo', { targetDay: 'Lunes' })).toBe('lunes');
  });

  it('lista compartida SIN targetDay (o "indiferente"): el último día posible, lunes', () => {
    expect(resolveTaskEvalDay('domingo', { text: 'x' })).toBe('lunes');
    expect(resolveTaskEvalDay('domingo', { targetDay: '' })).toBe('lunes');
    expect(resolveTaskEvalDay('sundayMonday', 'texto plano')).toBe('lunes');
  });
});

describe('getTaskPastStatus / isTaskPast — bugs reales del 20/09', () => {
  const GRACE = 45;
  const devolucionLunes = { text: 'Devolución Camión Albacar', timeFrame: '13:00 - 13:30' };
  const recogidaDomingo = { text: 'Recogida Refranys', timeFrame: '15:00 - 17:00', targetDay: 'Domingo' };
  const recogidaSinEtiqueta = { text: 'Recogida Refranys', timeFrame: '15:00 - 17:00' };

  it('BUG: una devolución del lunes sin etiquetar NO se da por hecha el domingo por la mañana', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', devolucionLunes, at(2026, 9, 20, 20, 17), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', devolucionLunes, at(2026, 9, 21, 10, 46), GRACE)).toBe(false);
  });

  it('una tarea sin etiquetar tampoco se marca el domingo por la tarde, aunque su hora de domingo ya haya pasado', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', recogidaSinEtiqueta, at(2026, 9, 20, 20, 17), GRACE)).toBe(false);
  });

  it('con targetDay "Domingo" sí termina el domingo, pero no antes de hora + margen', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', recogidaDomingo, at(2026, 9, 20, 17, 30), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', recogidaDomingo, at(2026, 9, 20, 17, 46), GRACE)).toBe(true);
  });

  it('la tarea del lunes termina el lunes a su hora (sin arrastrar el domingo)', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', devolucionLunes, at(2026, 9, 21, 13, 40), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'domingo', devolucionLunes, at(2026, 9, 21, 14, 16), GRACE)).toBe(true);
  });

  it('BUG: una SEMANA FUTURA no tiene nada pasado, aunque hoy (domingo) sea "posterior" a su martes-sábado por día de la semana', () => {
    const proxima = semana('Del 22 al 27 de Septiembre de 2026');
    const ahora = at(2026, 9, 20, 20, 17);
    for (const dia of ['martes', 'miercoles', 'jueves', 'viernes']) {
      expect(isTaskPast(proxima, dia, { timeFrame: '09:00 - 10:00' }, ahora, GRACE)).toBe(false);
    }
    expect(isTaskPast(proxima, 'sabado', { timeFrame: '20:30 - 00:30' }, ahora, GRACE)).toBe(false);
  });

  it('una semana ya terminada sí tiene pasado todo lo que tenga horario', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'martes', { timeFrame: '09:00 - 10:00' }, at(2026, 9, 22, 8), GRACE)).toBe(true);
  });

  it('boda de sábado que cruza medianoche: sigue vigente de madrugada del domingo y termina con el margen', () => {
    const boda = { location: 'Finca', timeFrame: '20:30 - 00:30' };
    expect(isTaskPast(SEMANA_ACTUAL, 'sabado', boda, at(2026, 9, 19, 23, 0), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'sabado', boda, at(2026, 9, 20, 0, 40), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'sabado', boda, at(2026, 9, 20, 1, 20), GRACE)).toBe(true);
  });

  it('sin horario utilizable NO se da por pasada solo porque el día terminó', () => {
    expect(isTaskPast(SEMANA_ACTUAL, 'martes', { text: 'Sin hora' }, at(2026, 9, 25, 12), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'martes', 'texto plano', at(2026, 9, 25, 12), GRACE)).toBe(false);
    expect(isTaskPast(SEMANA_ACTUAL, 'martes', { timeFrame: 'todo el día' }, at(2026, 9, 25, 12), GRACE)).toBe(false);
  });

  it('con dateRange ilegible devuelve null y isTaskPast false: quien escribe en Mongo se abstiene', () => {
    const rara = semana('Fechas generadas por Asistente Gemini AI');
    const t = { timeFrame: '09:00 - 10:00' };
    expect(getTaskPastStatus(rara, 'martes', t, at(2026, 9, 25, 12), GRACE)).toBeNull();
    expect(isTaskPast(rara, 'martes', t, at(2026, 9, 25, 12), GRACE)).toBe(false);
    expect(isTaskPast(null, 'martes', t, at(2026, 9, 25, 12), GRACE)).toBe(false);
  });
});

describe('ensureYearInDateRange', () => {
  const now = at(2026, 9, 20);
  it('añade el año si falta y el texto se entiende', () => {
    expect(ensureYearInDateRange('Del 22 al 27 de Septiembre', now)).toBe('Del 22 al 27 de Septiembre de 2026');
  });
  it('no toca textos que ya traen año o que no se entienden', () => {
    expect(ensureYearInDateRange('Del 15 al 20 de Septiembre de 2026', now)).toBe('Del 15 al 20 de Septiembre de 2026');
    expect(ensureYearInDateRange('la semana que viene', now)).toBe('la semana que viene');
  });
});

describe('clearWeekCompletion', () => {
  it('deja todas las tareas y camiones sin completar, sin mutar la semana original', () => {
    const original = {
      schedule: { martes: { title: 'Martes', tasks: [{ text: 'a', completed: true }, 'plano'] } },
      saturdaySpecial: { weddings: [{ location: 'Finca', completed: true }] },
      sundayMonday: { title: 'D/L', tasks: [{ text: 'b', completed: true, targetDay: 'Lunes' }] },
      trucks: [{ name: 'Albacar', pickupCompleted: true, returnCompleted: true }],
    };
    const limpia = clearWeekCompletion(original);
    expect(limpia.schedule.martes.tasks).toEqual([{ text: 'a', completed: false }, 'plano']);
    expect(limpia.saturdaySpecial.weddings[0].completed).toBe(false);
    expect(limpia.sundayMonday.tasks[0]).toEqual({ text: 'b', completed: false, targetDay: 'Lunes' });
    expect(limpia.trucks[0]).toMatchObject({ pickupCompleted: false, returnCompleted: false });
    expect(original.sundayMonday.tasks[0].completed).toBe(true);
  });
});

describe('getDayLabel', () => {
  const ahora = at(2026, 9, 20);
  it('pone el número REAL del día según dateRange (el lunes es el de cola)', () => {
    expect(getDayLabel(SEMANA_ACTUAL, 'martes', ahora)).toBe('Martes 15');
    expect(getDayLabel(SEMANA_ACTUAL, 'miercoles', ahora)).toBe('Miércoles 16');
    expect(getDayLabel(SEMANA_ACTUAL, 'domingo', ahora)).toBe('Domingo 20');
    expect(getDayLabel(SEMANA_ACTUAL, 'lunes', ahora)).toBe('Lunes 21');
  });
  it('la semana siguiente lleva SUS números, no los de la anterior', () => {
    const proxima = semana('Del 22 al 27 de Septiembre de 2026');
    expect(getDayLabel(proxima, 'martes', ahora)).toBe('Martes 22');
    expect(getDayLabel(proxima, 'lunes', ahora)).toBe('Lunes 28');
  });
  it('sin fechas legibles, solo el nombre (nunca un número inventado)', () => {
    expect(getDayLabel(semana('Fechas raras'), 'jueves', ahora)).toBe('Jueves');
    expect(getDayLabel(null, 'sabado', ahora)).toBe('Sábado');
  });
});

describe('getWeddingsBadge', () => {
  it('cuenta fincas distintas, no filas (montaje + evento de la misma finca = 1)', () => {
    const w = { saturdaySpecial: { weddings: [{ location: 'A' }, { location: 'B' }, { location: 'B' }, { location: 'C' }, { location: 'C' }] } };
    expect(getWeddingsBadge(w)).toBe('3 Bodas');
    expect(getWeddingsBadge({ saturdaySpecial: { weddings: [{ location: 'A' }, { location: 'A' }] } })).toBe('1 Boda');
    expect(getWeddingsBadge({ saturdaySpecial: { weddings: [] } })).toBe('Sin bodas');
    expect(getWeddingsBadge(null)).toBe('Sin bodas');
  });
});

describe('isTaskTooEarlyToStart — fichar solo desde 5 min antes, por fecha real', () => {
  const sofa = { text: 'Devolución Sofá', timeFrame: '09:00 - 09:30' }; // sin etiquetar -> lunes
  const recogida = { text: 'Recogida', timeFrame: '15:00-17:00', targetDay: 'Domingo' };

  it('BUG evitado: el lunes a la 01:34 no se puede fichar una tarea de lunes de las 09:00', () => {
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 1, 34))).toBe(true);
  });

  it('se habilita exactamente 5 minutos antes de empezar', () => {
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 8, 54))).toBe(true);
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 8, 55))).toBe(false);
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 9, 20))).toBe(false); // ya empezada
  });

  it('una tarea etiquetada "Solo Domingo" cuenta con el domingo, no con el lunes', () => {
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', recogida, at(2026, 9, 20, 12, 0))).toBe(true);
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', recogida, at(2026, 9, 20, 14, 56))).toBe(false);
  });

  it('una semana futura no se puede fichar aunque la hora del día ya haya pasado hoy', () => {
    const proxima = semana('Del 22 al 27 de Septiembre de 2026');
    expect(isTaskTooEarlyToStart(proxima, 'martes', { timeFrame: '09:00 - 10:00' }, at(2026, 9, 20, 20, 0))).toBe(true);
  });

  it('sin fechas o sin hora legibles no bloquea', () => {
    expect(isTaskTooEarlyToStart(semana('Fechas raras'), 'martes', { timeFrame: '09:00 - 10:00' }, at(2026, 9, 15, 1, 0))).toBe(false);
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'martes', { text: 'sin hora' }, at(2026, 9, 15, 1, 0))).toBe(false);
    expect(getTaskStartDateTime(SEMANA_ACTUAL, 'martes', 'texto plano', at(2026, 9, 15))).toBeNull();
  });
});

describe('getNextTaskStart — tareas sin etiquetar domingo/lunes', () => {
  const sofa = { text: 'Devolución Sofá', timeFrame: '09:00 - 09:30' };
  const refranys = { text: 'Recogida Refranys', timeFrame: '15:00-17:00' };
  const hhmm = (d) => d && `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

  it('el domingo a las 14:00: la de las 15:00 es la del domingo y la de las 09:00 la del lunes', () => {
    const ahora = at(2026, 9, 20, 14, 0);
    expect(hhmm(getNextTaskStart(SEMANA_ACTUAL, 'domingo', refranys, ahora))).toBe('20 15:00');
    expect(hhmm(getNextTaskStart(SEMANA_ACTUAL, 'domingo', sofa, ahora))).toBe('21 9:00');
  });

  it('el domingo a las 08:00 la de las 09:00 es la del propio domingo (se puede fichar desde las 08:55)', () => {
    expect(hhmm(getNextTaskStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 20, 8, 0)))).toBe('20 9:00');
    expect(isTaskTooEarlyToStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 20, 8, 56))).toBe(false);
  });

  it('el lunes de madrugada la de las 09:00 es la del lunes (BUG de la captura: se podía fichar a la 01:34)', () => {
    expect(hhmm(getNextTaskStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 1, 34)))).toBe('21 9:00');
  });

  it('con etiqueta manda su día; ya terminada del todo -> null', () => {
    expect(hhmm(getNextTaskStart(SEMANA_ACTUAL, 'domingo', { ...sofa, targetDay: 'Lunes' }, at(2026, 9, 20, 10, 0)))).toBe('21 9:00');
    expect(getNextTaskStart(SEMANA_ACTUAL, 'domingo', { ...sofa, targetDay: 'Domingo' }, at(2026, 9, 21, 1, 0))).toBeNull();
    expect(getNextTaskStart(SEMANA_ACTUAL, 'domingo', sofa, at(2026, 9, 21, 12, 0))).toBeNull();
  });
});

describe('isTaskEffectivelyDone — lo que se ve, lo que hace el clic y lo que se guarda', () => {
  const generador = { text: 'Devolución Generador', timeFrame: '09:30 - 10:00', targetDay: 'Lunes', completed: false };

  it('BUG evitado: a las 10:03 (captura) NO se ve hecha una tarea de 09:30-10:00: hasta las 10:45 (margen de 45 min)', () => {
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', generador, at(2026, 9, 21, 10, 3))).toBe(false);
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', generador, at(2026, 9, 21, 10, 44))).toBe(false);
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', generador, at(2026, 9, 21, 10, 46))).toBe(true);
  });

  it('completed:true siempre está hecha', () => {
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', { ...generador, completed: true }, at(2026, 9, 21, 6, 0))).toBe(true);
  });

  it('BUG evitado: una tarea desmarcada a propósito (reopened) NO vuelve a darse por hecha por la hora', () => {
    const reabierta = { ...generador, reopened: true };
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', reabierta, at(2026, 9, 21, 12, 0))).toBe(false);
    // ...pero si alguien la marca, vale
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'domingo', { ...reabierta, completed: true }, at(2026, 9, 21, 12, 0))).toBe(true);
  });

  it('texto plano y tareas sin horario no se dan por hechas por el reloj', () => {
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'martes', 'texto', at(2026, 9, 25, 12, 0))).toBe(false);
    expect(isTaskEffectivelyDone(SEMANA_ACTUAL, 'martes', { text: 'sin hora' }, at(2026, 9, 25, 12, 0))).toBe(false);
  });

  it('clearWeekCompletion también quita el desmarcado a mano', () => {
    const w = { sundayMonday: { tasks: [{ text: 'a', completed: false, reopened: true }] } };
    expect(clearWeekCompletion(w).sundayMonday.tasks[0]).toEqual({ text: 'a', completed: false });
  });
});
