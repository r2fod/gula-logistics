import { describe, it, expect, beforeEach } from 'vitest';
import { informeDeEventos } from './informeEventos';
import { pairShiftsFromEntries } from './shiftCalculations';
import { repartirTiempoSinTarea } from './repartoPorPlanning';
import { buildPaxRegistry, buildTaskContextResolver } from './eventNaming';
import { summarizeByEvent } from './eventSummary';
import { usarTarifasPorDefecto } from './tarifasPorDefecto';

// Semana inventada del 13 al 18 de octubre de 2026 (lunes 19 de cola) con dos bodas.
const semanas = {
  w1: {
    meta: { dateRange: 'Del 13 al 18 de Octubre de 2026', status: 'Operativa Activa' },
    events: [{ name: 'Boda Uno', pax: 160 }, { name: 'Boda Dos', pax: 100 }],
    schedule: {
      martes: { tasks: [] },
      miercoles: { tasks: [{ id: 'mi1', text: 'Boda Uno + Boda Dos - Preparación de material', timeFrame: '10:00 - 19:00', assigned: ['Ana'] }] },
      jueves: { tasks: [{ id: 'j1', text: 'Boda Uno - Descarga + montaje', timeFrame: '11:30 - 15:00', assigned: ['Luis', 'Ana'] }] },
      viernes: { tasks: [{ id: 'v1', text: 'Boda Dos - Descarga', timeFrame: '13:30 - 17:30', assigned: ['Eva'] }] },
    },
    saturdaySpecial: { weddings: [] },
    sundayMonday: { tasks: [] },
  },
};
const equipo = [{ name: 'Ana', role: 'Ayudante Logística', rate: 10 }, { name: 'Luis', role: 'Conductor Flota', rate: 10 }, { name: 'Eva', role: 'Limpieza Eventos', rate: 12 }];
const hora = (dia, h, m = 0) => new Date(2026, 9, dia, h, m).toISOString();
let id = 0;
const turno = (nombre, dia, h1, h2, rate = 10) => [
  { id: `e${++id}`, workerName: nombre, type: 'entrada', timestamp: hora(dia, h1), taskName: 'JORNADA', rate },
  { id: `s${id}`, workerName: nombre, type: 'salida', timestamp: hora(dia, h2), rate },
];
const preparar = (fichajes) => {
  const resolveEvent = buildTaskContextResolver(semanas);
  const paxByEvent = buildPaxRegistry(semanas);
  const turnos = repartirTiempoSinTarea(pairShiftsFromEntries(fichajes).shifts, semanas, resolveEvent, new Date(2026, 9, 21));
  return { turnos, resolveEvent, paxByEvent, equipo, semanas, ahora: new Date(2026, 9, 21) };
};

describe('informeDeEventos — el personal de cada evento, turno a turno', () => {
  beforeEach(() => usarTarifasPorDefecto({ extra: 10 }));

  const fichajes = [...turno('Ana', 14, 10, 19), ...turno('Ana', 15, 11, 15), ...turno('Luis', 15, 11, 15), ...turno('Luis', 13, 10, 12)];

  it('cuadra con el desglose por evento del Resumen financiero (mismo reparto)', () => {
    const datos = preparar(fichajes);
    const [uno, dos] = informeDeEventos({ eventos: ['Boda Uno', 'Boda Dos'], ...datos });
    const resumen = summarizeByEvent(datos.turnos, equipo, datos.paxByEvent, datos.resolveEvent);
    const deResumen = (n) => resumen.find(e => e.eventName === n);
    expect(uno.horas).toBeCloseTo(deResumen('Boda Uno').totalHours, 6);
    expect(uno.coste).toBeCloseTo(deResumen('Boda Uno').totalCost, 6);
    expect(dos.horas).toBeCloseTo(deResumen('Boda Dos').totalHours, 6);
    expect(uno.pax).toBe(160);
  });

  it('cada fila dice entrada, salida, la parte del turno para ese evento, la tarea y si se compartió', () => {
    const [uno, dos] = informeDeEventos({ eventos: ['Boda Uno', 'Boda Dos'], ...preparar(fichajes) });
    const prep = uno.filas.find(f => f.nombre === 'Ana' && f.inicio.getDate() === 14);
    expect(prep).toMatchObject({ horasTurno: 9, tarifa: 10, compartido: true, estimado: true, otroDia: false, tareas: ['Preparación de material'] });
    expect(prep.horas).toBeCloseTo(9 * 160 / 260, 6); // la preparación de las dos bodas, por pax
    expect(dos.filas.find(f => f.nombre === 'Ana').horas).toBeCloseTo(9 * 100 / 260, 6);
    expect(prep.inicio.getHours()).toBe(10);
    expect(prep.fin.getHours()).toBe(19);
  });

  it('un turno de un día sin tarea de ese evento se marca (repartido con las de otro día de la semana)', () => {
    const [uno] = informeDeEventos({ eventos: ['Boda Uno'], ...preparar(fichajes) });
    expect(uno.filas.find(f => f.nombre === 'Luis' && f.inicio.getDate() === 13)).toMatchObject({ otroDia: true });
    expect(uno.filas.find(f => f.nombre === 'Luis' && f.inicio.getDate() === 15)).toMatchObject({ otroDia: false });
  });

  it('quien estaba en el planning del evento y no fichó ese día sale aparte (no suma)', () => {
    const [uno, dos] = informeDeEventos({ eventos: ['Boda Uno', 'Boda Dos'], ...preparar(fichajes) });
    expect(dos.sinFichar).toEqual([expect.objectContaining({ nombre: 'Eva', rol: 'Limpieza Eventos', tarea: 'Descarga' })]);
    expect(uno.sinFichar).toEqual([]);
  });

  it('con bolsa de horas el €/hora es el medio del turno, para que horas × €/hora dé su coste', () => {
    const datos = preparar([...turno('Luis', 15, 11, 15)]);
    datos.turnos = datos.turnos.map(s => ({ ...s, subTasks: s.subTasks.map(st => ({ ...st, cost: st.cost * 0.8 })) })); // como aplicarTarifaDeBolsa
    const [fila] = informeDeEventos({ eventos: ['Boda Uno'], ...datos })[0].filas;
    expect(fila.bolsa).toBe(true);
    expect(fila.tarifa).toBeCloseTo(8, 6);
    expect(fila.horas * fila.tarifa).toBeCloseTo(fila.coste, 6);
  });
});
