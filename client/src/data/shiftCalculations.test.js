import { describe, it, expect } from 'vitest';
import {
  sortEntriesByTimestamp,
  getActiveShiftForWorker,
  pairShiftsFromEntries,
  aggregateShiftsByWorker,
} from './shiftCalculations';

// Helper para no repetir campos en cada fichaje de prueba.
function entry(overrides) {
  return {
    id: 'e1',
    workerName: 'Kerly',
    type: 'entrada',
    timestamp: '2026-09-10T08:00:00.000Z',
    timeFormatted: '10:00',
    dateFormatted: '10/09/2026',
    ...overrides,
  };
}

describe('sortEntriesByTimestamp', () => {
  it('ordena de más antiguo a más reciente sin mutar el array original', () => {
    const original = [
      entry({ id: 'b', timestamp: '2026-09-10T10:00:00.000Z' }),
      entry({ id: 'a', timestamp: '2026-09-10T08:00:00.000Z' }),
    ];
    const sorted = sortEntriesByTimestamp(original);

    expect(sorted.map(e => e.id)).toEqual(['a', 'b']);
    expect(original.map(e => e.id)).toEqual(['b', 'a']); // el original no cambia
  });

  it('devuelve un array vacío si no se le pasa nada', () => {
    expect(sortEntriesByTimestamp()).toEqual([]);
  });
});

describe('getActiveShiftForWorker', () => {
  it('detecta el fichaje activo aunque el array venga en orden DESC (como lo manda el servidor)', () => {
    // Este es exactamente el bug real de "no desficha": el servidor devuelve
    // los fichajes más recientes primero, así que si esta función mirase
    // solo la posición del array en vez de la fecha, cogería la entrada más
    // antigua como si fuera la activa.
    const entries = [
      entry({ id: '2', type: 'salida', timestamp: '2026-09-10T16:00:00.000Z' }),
      entry({ id: '1', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '4', type: 'entrada', timestamp: '2026-09-11T08:00:00.000Z' }),
      entry({ id: '3', type: 'salida', timestamp: '2026-09-10T09:00:00.000Z' }),
    ];

    const active = getActiveShiftForWorker(entries, 'Kerly');
    expect(active?.id).toBe('4');
  });

  it('devuelve null si el último movimiento del trabajador fue una salida', () => {
    const entries = [
      entry({ id: '1', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', type: 'salida', timestamp: '2026-09-10T16:00:00.000Z' }),
    ];
    expect(getActiveShiftForWorker(entries, 'Kerly')).toBeNull();
  });

  it('ignora mayúsculas/minúsculas al buscar por nombre', () => {
    const entries = [entry({ workerName: 'Kerly', type: 'entrada' })];
    expect(getActiveShiftForWorker(entries, 'kerly')?.id).toBe('e1');
  });

  it('devuelve null sin trabajador o sin fichajes', () => {
    expect(getActiveShiftForWorker([], 'Kerly')).toBeNull();
    expect(getActiveShiftForWorker([entry()], '')).toBeNull();
  });
});

describe('pairShiftsFromEntries', () => {
  it('empareja entrada+salida y calcula duración y coste con la tarifa Extra (10€/h)', () => {
    const entries = [
      entry({ id: '1', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', workerName: 'Ricardo', type: 'salida', timestamp: '2026-09-10T10:30:00.000Z' }),
    ];
    const { shifts, activeShifts } = pairShiftsFromEntries(entries);

    expect(shifts).toHaveLength(1);
    expect(shifts[0]).toMatchObject({
      workerName: 'Ricardo',
      isSalaried: false,
      rate: 10,
      durationFormatted: '2h 30m',
    });
    expect(shifts[0].durationHours).toBeCloseTo(2.5);
    expect(shifts[0].cost).toBeCloseTo(25);
    expect(activeShifts).toEqual({});
  });

  it('usa la tarifa Nómina (14€/h) para Irene y Raúl', () => {
    const entries = [
      entry({ id: '1', workerName: 'Irene', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', workerName: 'Irene', type: 'salida', timestamp: '2026-09-10T09:00:00.000Z' }),
    ];
    const { shifts } = pairShiftsFromEntries(entries);
    expect(shifts[0]).toMatchObject({ isSalaried: true, rate: 14, cost: 14 });
  });

  it('respeta una tarifa custom (`rate`) del propio fichaje por encima de los defaults', () => {
    const entries = [
      entry({ id: '1', workerName: 'Johan', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', workerName: 'Johan', type: 'salida', timestamp: '2026-09-10T09:00:00.000Z', rate: 20 }),
    ];
    const { shifts } = pairShiftsFromEntries(entries);
    expect(shifts[0].rate).toBe(20);
    expect(shifts[0].cost).toBe(20);
  });

  it('deja en activeShifts una entrada sin salida emparejada', () => {
    const entries = [entry({ id: '1', workerName: 'Gonzalo', type: 'entrada' })];
    const { shifts, activeShifts } = pairShiftsFromEntries(entries);
    expect(shifts).toHaveLength(0);
    expect(activeShifts.Gonzalo?.id).toBe('1');
  });

  it('ignora una salida suelta sin entrada previa (no rompe ni genera turno negativo)', () => {
    const entries = [entry({ id: '1', workerName: 'Gonzalo', type: 'salida' })];
    const { shifts } = pairShiftsFromEntries(entries);
    expect(shifts).toHaveLength(0);
  });

  it('si la salida quedara cronológicamente antes que la entrada, no la empareja (datos corruptos) en vez de generar un turno con coste negativo', () => {
    // Como pairShiftsFromEntries procesa en orden cronológico ascendente
    // (sortEntriesByTimestamp), una "salida" con timestamp anterior a
    // cualquier "entrada" del mismo trabajador se procesa ANTES de que haya
    // ningún turno abierto que cerrar, así que se descarta en silencio en
    // vez de emparejarse con la entrada posterior y dar una duración negativa.
    const entries = [
      entry({ id: '1', workerName: 'Johan', type: 'entrada', timestamp: '2026-09-10T10:00:00.000Z' }),
      entry({ id: '2', workerName: 'Johan', type: 'salida', timestamp: '2026-09-10T08:00:00.000Z' }),
    ];
    const { shifts, activeShifts } = pairShiftsFromEntries(entries);
    expect(shifts).toHaveLength(0);
    expect(activeShifts.Johan?.id).toBe('1'); // la entrada queda "abierta", esperando una salida real
  });

  it('procesa turnos de varios trabajadores en paralelo sin cruzarlos', () => {
    const entries = [
      entry({ id: '1', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', workerName: 'Johan', type: 'entrada', timestamp: '2026-09-10T08:30:00.000Z' }),
      entry({ id: '3', workerName: 'Ricardo', type: 'salida', timestamp: '2026-09-10T09:00:00.000Z' }),
      entry({ id: '4', workerName: 'Johan', type: 'salida', timestamp: '2026-09-10T09:30:00.000Z' }),
    ];
    const { shifts } = pairShiftsFromEntries(entries);
    expect(shifts).toHaveLength(2);
    expect(shifts.find(s => s.workerName === 'Ricardo').durationFormatted).toBe('1h 0m');
    expect(shifts.find(s => s.workerName === 'Johan').durationFormatted).toBe('1h 0m');
  });
});

describe('aggregateShiftsByWorker', () => {
  const workersList = [
    { name: 'Ricardo', role: 'Veterano', avatar: '👷', isPayroll: false },
    { name: 'Irene', role: 'Nómina', avatar: '👩', isPayroll: true },
  ];

  it('inicializa a todos los trabajadores de la lista en cero, aunque no tengan turnos', () => {
    const result = aggregateShiftsByWorker([], workersList);
    expect(result.Ricardo).toMatchObject({ totalHours: 0, totalCost: 0, completedShifts: 0, rate: 10 });
    expect(result.Irene).toMatchObject({ totalHours: 0, totalCost: 0, completedShifts: 0, rate: 14 });
  });

  it('suma horas, coste y nº de turnos por trabajador', () => {
    const shifts = [
      { workerName: 'Ricardo', durationHours: 2, cost: 20 },
      { workerName: 'Ricardo', durationHours: 3, cost: 30 },
    ];
    const result = aggregateShiftsByWorker(shifts, workersList);
    expect(result.Ricardo).toMatchObject({ totalHours: 5, totalCost: 50, completedShifts: 2 });
  });

  it('ignora turnos de alguien que ya no está en workersList (huérfanos), sin romper', () => {
    const shifts = [{ workerName: 'Ex-trabajador', durationHours: 5, cost: 50 }];
    expect(() => aggregateShiftsByWorker(shifts, workersList)).not.toThrow();
    expect(Object.keys(aggregateShiftsByWorker(shifts, workersList))).toEqual(['Ricardo', 'Irene']);
  });
});
