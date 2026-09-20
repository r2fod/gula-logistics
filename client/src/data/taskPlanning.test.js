import { describe, it, expect } from 'vitest';
import { getTaskListForDay, resolveTaskIndexByText, buildTaskListPatch, isTaskChronologicallyPast, isTaskTooEarlyToClockIn } from './taskPlanning';

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
