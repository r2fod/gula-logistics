import { describe, it, expect } from 'vitest';
import { tareasDeLaVispera, fichadosDelDia } from './vispera';
import { pairShiftsFromEntries } from './shiftCalculations';

const hoy = new Date(2026, 8, 21, 20, 0);
const anterior = (tareas, status = 'Operativa Activa') => ({ name: 'Semana 3', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status }, sundayMonday: { tasks: tareas } });
const actual = () => ({ name: 'Semana 4', meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Operativa Activa' } });
const t = (text, targetDay, timeFrame, assigned = ['Ana']) => ({ text, targetDay, timeFrame, assigned });

describe('tareasDeLaVispera', () => {
  it('BUG evitado: enseña TODO el lunes de la semana anterior (devoluciones, cargas y limpieza), no solo lo de los eventos de esta semana', () => {
    const devolucion = t('Devolución material alquiler', 'Lunes', '11:30-12:30', ['Luis', 'Marta']);
    const carga = t('Evento Uno - Carga camión', 'Lunes', '17:00-17:30');
    const limpieza = t('Lunes — Limpieza de vajilla', undefined, '09:00 - 15:00', ['Eva']); // sin día: cuenta como lunes
    const domingo = t('Recogida', 'Domingo', '15:00-17:00');
    const semanas = { a: anterior([carga, domingo, devolucion, limpieza]), b: actual() };
    const v = tareasDeLaVispera(semanas, semanas.b, hoy);
    expect(v.fecha).toEqual(new Date(2026, 8, 21));
    expect(v.semana.name).toBe('Semana 3');
    expect(v.tareas.map(x => x.task.text)).toEqual(['Lunes — Limpieza de vajilla', 'Devolución material alquiler', 'Evento Uno - Carga camión']); // por hora
  });

  it('cada tarea conserva su posición en la lista original (para editarla donde está guardada)', () => {
    const semanas = { a: anterior([t('x', 'Domingo', '10:00-11:00'), t('y', 'Lunes', '10:00-11:00')]), b: actual() };
    expect(tareasDeLaVispera(semanas, semanas.b, hoy).tareas[0].idx).toBe(1);
  });

  it('las tareas sin horario van al final', () => {
    const semanas = { a: anterior([t('sin hora', 'Lunes', undefined), t('con hora', 'Lunes', '09:00-10:00')]), b: actual() };
    expect(tareasDeLaVispera(semanas, semanas.b, hoy).tareas.map(x => x.task.text)).toEqual(['con hora', 'sin hora']);
  });

  it('null si no hay semana anterior legible, si es un borrador o si no tiene tareas de lunes', () => {
    expect(tareasDeLaVispera({ b: actual() }, actual(), hoy)).toBeNull();
    const conBorrador = { a: anterior([t('x', 'Lunes', '10:00-11:00')], 'Borrador'), b: actual() };
    expect(tareasDeLaVispera(conBorrador, conBorrador.b, hoy)).toBeNull();
    const soloDomingo = { a: anterior([t('x', 'Domingo', '10:00-11:00')]), b: actual() };
    expect(tareasDeLaVispera(soloDomingo, soloDomingo.b, hoy)).toBeNull();
    expect(tareasDeLaVispera({ a: anterior([t('x', 'Lunes', '10:00-11:00')]) }, { name: 'X', meta: { dateRange: 'fechas raras' } }, hoy)).toBeNull();
  });
});

describe('fichadosDelDia', () => {
  let n = 0;
  const turno = (workerName, ini, fin) => ['entrada', 'salida'].map((type, i) => ({ id: `f${++n}`, workerName, type, timestamp: (i ? fin : ini).toISOString(), taskName: 'JORNADA', isPayroll: false, rate: 10 }));
  const { shifts } = pairShiftsFromEntries([
    ...turno('Luis', new Date(2026, 8, 21, 11, 54), new Date(2026, 8, 21, 17, 38)), // 5,5 h
    ...turno('Marta', new Date(2026, 8, 21, 11, 51), new Date(2026, 8, 21, 14, 30)), // 2,5 h
    ...turno('Luis', new Date(2026, 8, 20, 17, 0), new Date(2026, 8, 21, 1, 30)), // empezó el domingo: no cuenta el lunes
    ...turno('Eva', new Date(2026, 8, 21, 14, 58), new Date(2026, 8, 21, 18, 3)), // 3 h
  ]);

  it('quién fichó ese día y cuántas horas, de más a menos; un turno cuenta en el día en que empieza', () => {
    expect(fichadosDelDia(shifts, new Date(2026, 8, 21))).toEqual([
      { nombre: 'Luis', horas: 5.5 },
      { nombre: 'Eva', horas: 3 },
      { nombre: 'Marta', horas: 2.5 },
    ]);
  });

  it('un día sin fichajes da una lista vacía', () => {
    expect(fichadosDelDia(shifts, new Date(2026, 8, 25))).toEqual([]);
    expect(fichadosDelDia(undefined, new Date())).toEqual([]);
  });
});
