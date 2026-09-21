import { describe, it, expect } from 'vitest';
import { pairShiftsFromEntries } from './shiftCalculations';
import { buildTaskContextResolver, buildPaxRegistry } from './eventNaming';
import { summarizeByEvent } from './eventSummary';
import { repartirTiempoSinTarea, listarTareasPlanificadas } from './repartoPorPlanning';

const at = (d, h, m = 0) => new Date(2026, 8, d, h, m);

// Semana ficticia del 15 al 20 de septiembre (cola: lunes 21).
const semana = (extra = {}) => ({
  id: 'week_x', name: 'Semana X',
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Operativa Activa' },
  events: [{ name: 'Boda Uno', pax: 100 }, { name: 'Boda Dos', pax: 50 }],
  schedule: {},
  saturdaySpecial: { weddings: [
    { location: 'Finca Norte', truck: 'Camión A', timeFrame: '20:00-23:30', assigned: ['Ana'], event: 'Boda Uno' },
    { location: 'Finca Sur', truck: 'Camión B', timeFrame: '20:30-22:30', assigned: ['Ana', 'Luis'], event: 'Boda Dos' },
  ] },
  sundayMonday: { tasks: [
    { text: 'Recogida Boda Uno', timeFrame: '15:00-17:00', targetDay: 'Domingo', assigned: ['Luis'], event: 'Boda Uno' },
    { text: 'Devolución material', timeFrame: '11:00-12:00', targetDay: 'Lunes', assigned: ['Luis'], event: 'Logística Preparación' },
    { text: 'Limpieza de vajilla', timeFrame: '09:00-15:00', targetDay: 'Lunes', assigned: ['Eva'], event: 'Limpieza Eventos' },
  ] },
  ...extra,
});

let n = 0;
const turno = (workerName, ini, fin, taskName = 'Inicio de Jornada') => {
  const base = { workerName, role: 'x', isPayroll: false, rate: 10 };
  const e = (type, d) => ({ ...base, type, id: `e${++n}`, timestamp: d.toISOString(), taskName });
  return [e('entrada', ini), e('salida', fin)];
};
const turnos = (...tramos) => pairShiftsFromEntries(tramos.flatMap(t => turno(...t))).shifts;
const porEvento = (shifts, weeks) => {
  const resolve = buildTaskContextResolver(weeks);
  return Object.fromEntries(summarizeByEvent(shifts, [], buildPaxRegistry(weeks), resolve).map(e => [e.eventName, e]));
};

describe('repartirTiempoSinTarea', () => {
  it('reparte el turno sin tarea entre las tareas asignadas que se solapan, sin cambiar ni horas ni coste', () => {
    const weeks = { w: semana() };
    const shifts = turnos(['Luis', at(19, 20, 30), at(20, 1, 0)]); // 4,5 h; solo la boda Dos (20:30-22:30) es suya
    const rep = repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18));
    const ev = porEvento(rep, weeks);

    expect(ev['Boda Dos'].totalHours).toBeCloseTo(4.5);
    expect(ev['Boda Dos'].totalCost).toBeCloseTo(45);
    expect(ev['Boda Dos'].horasEstimadas).toBeCloseTo(4.5);
    expect(ev['Tareas Internas']).toBeUndefined();
    expect(rep[0].durationHours).toBe(shifts[0].durationHours); // el turno no cambia
    expect(rep[0].cost).toBe(shifts[0].cost);
  });

  it('con varias tareas solapadas reparte en proporción a los minutos de solape', () => {
    const weeks = { w: semana() };
    // Ana 20:00-23:30: solapa 3,5 h con la boda Uno (20:00-23:30) y 2 h con la Dos (20:30-22:30) -> 3,5/5,5 y 2/5,5
    const shifts = turnos(['Ana', at(19, 20, 0), at(19, 23, 30)]);
    const rep = repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18));
    const ev = porEvento(rep, weeks);

    expect(ev['Boda Uno'].totalHours).toBeCloseTo(3.5 * 3.5 / 5.5, 1);
    expect(ev['Boda Dos'].totalHours).toBeCloseTo(3.5 * 2 / 5.5, 1);
    expect(ev['Boda Uno'].totalHours + ev['Boda Dos'].totalHours).toBeCloseTo(shifts[0].durationHours);
  });

  it('sin solape, usa las tareas suyas de ese mismo día según lo que dura cada una', () => {
    const weeks = { w: semana() };
    // Luis domingo 17:30-19:30: la recogida (15:00-17:00) ya acabó, pero es lo único suyo ese día
    const shifts = turnos(['Luis', at(20, 17, 30), at(20, 19, 30)]);
    const ev = porEvento(repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18)), weeks);
    expect(ev['Boda Uno'].totalHours).toBeCloseTo(2);
  });

  it('sin nada ese día, usa las tareas suyas de la semana (limpieza el domingo, tarea planificada el lunes)', () => {
    const weeks = { w: semana() };
    const shifts = turnos(['Eva', at(20, 8, 0), at(20, 15, 30)]); // domingo; su única tarea es la del lunes
    const ev = porEvento(repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18)), weeks);
    expect(ev['Limpieza Eventos'].totalHours).toBeCloseTo(7.5);
    expect(ev['Limpieza Eventos'].horasEstimadas).toBeCloseTo(7.5);
  });

  it('quien no tiene ninguna tarea esa semana se queda en Tareas Internas: no se inventa un evento', () => {
    const weeks = { w: semana() };
    const shifts = turnos(['Nadie', at(20, 8, 0), at(20, 12, 0)]);
    const rep = repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18));
    expect(rep[0]).toBe(shifts[0]); // ni se copia
    expect(porEvento(rep, weeks)['Tareas Internas'].totalHours).toBeCloseTo(4);
  });

  it('un fichaje que ya está enlazado con una tarea del planning no se toca', () => {
    const weeks = { w: semana() };
    const shifts = turnos(['Luis', at(20, 15, 0), at(20, 17, 0), 'Recogida Boda Uno']);
    const rep = repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18));
    expect(rep[0]).toBe(shifts[0]);
    expect(porEvento(rep, weeks)['Boda Uno'].horasEstimadas).toBe(0);
  });

  it('los borradores no cuentan: sus tareas no reciben horas de una semana real', () => {
    const borrador = semana({ meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Borrador' } });
    const weeks = { w: borrador };
    expect(listarTareasPlanificadas(weeks, at(21, 18))).toEqual([]);
    const shifts = turnos(['Luis', at(20, 15, 0), at(20, 17, 0)]);
    expect(repartirTiempoSinTarea(shifts, weeks, null, at(21, 18))[0]).toBe(shifts[0]);
  });

  it('el reparto por planning usa los pax de SU semana para una tarea de varios eventos', () => {
    const w = semana();
    w.sundayMonday.tasks = [{ text: 'Boda Uno + Boda Dos - Recoger material', timeFrame: '15:00-17:00', targetDay: 'Domingo', assigned: ['Luis'] }];
    const weeks = { w };
    const shifts = turnos(['Luis', at(20, 15, 0), at(20, 17, 0)]); // 2 h
    const ev = porEvento(repartirTiempoSinTarea(shifts, weeks, buildTaskContextResolver(weeks), at(21, 18)), weeks);
    expect(ev['Boda Uno'].totalHours).toBeCloseTo(2 * 100 / 150);
    expect(ev['Boda Dos'].totalHours).toBeCloseTo(2 * 50 / 150);
  });
});
