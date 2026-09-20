import { describe, it, expect } from 'vitest';
import {
  sortEntriesByTimestamp,
  getActiveShiftForWorker,
  pairShiftsFromEntries,
  aggregateShiftsByWorker,
  isZombieShift,
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
    // El pago se redondea a la MEDIA hora más cercana (para pagar en
    // billetes de 5€/10€, no en céntimos), no a la hora completa. 2h30m cae
    // justo en un múltiplo de media hora, así que no hay redondeo que hacer.
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
    expect(shifts[0].durationHours).toBe(2.5);
    expect(shifts[0].cost).toBe(25);
    expect(activeShifts).toEqual({});
  });

  it('redondea a la media hora más cercana, NO a la hora completa', () => {
    // 2h31m está a 1min de 2.5h y a 29min de 3h -> debe quedarse en 2.5h.
    // Es el caso que distingue "redondeo a la hora" (bug) de "redondeo a la
    // media hora" (correcto): con Math.round(rawDuration) a secas, 2h31m
    // habría subido a 3h.
    const entries = [
      entry({ id: '1', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
      entry({ id: '2', workerName: 'Ricardo', type: 'salida', timestamp: '2026-09-10T10:31:00.000Z' }), // 2h31m
    ];
    const { shifts } = pairShiftsFromEntries(entries);
    expect(shifts[0].durationHours).toBe(2.5);
    expect(shifts[0].cost).toBe(25);
  });

  it('redondea hacia abajo por debajo del cuarto de hora, y hacia arriba desde ahí', () => {
    // Entre dos múltiplos de media hora (ej. 2.5h y 3h) el punto de corte
    // está en el cuarto de hora intermedio (2h45m): antes de eso baja al de
    // abajo, desde ahí sube al de arriba.
    const build = (mins) => {
      const entries = [
        entry({ id: '1', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-10T08:00:00.000Z' }),
        entry({ id: '2', workerName: 'Ricardo', type: 'salida', timestamp: new Date(new Date('2026-09-10T08:00:00.000Z').getTime() + mins * 60000).toISOString() }),
      ];
      return pairShiftsFromEntries(entries).shifts[0].durationHours;
    };
    expect(build(164)).toBe(2.5); // 2h44m -> aún más cerca de 2.5h
    expect(build(166)).toBe(3);   // 2h46m -> ya más cerca de 3h
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

  it('suma horas, coste y nº de turnos por trabajador (turnos en días distintos)', () => {
    // startDate distinto en cada uno: si coincidiera, aggregateShiftsByWorker
    // los agruparía como "Jornada Partida" (ver test de abajo) y
    // completedShifts contaría 1, no 2.
    const shifts = [
      { workerName: 'Ricardo', durationHours: 2, cost: 20, startDate: '10/09/2026', startTime: '08:00', endTime: '10:00' },
      { workerName: 'Ricardo', durationHours: 3, cost: 30, startDate: '11/09/2026', startTime: '08:00', endTime: '11:00' },
    ];
    const result = aggregateShiftsByWorker(shifts, workersList);
    expect(result.Ricardo).toMatchObject({ totalHours: 5, totalCost: 50, completedShifts: 2 });
  });

  it('agrupa turnos del mismo día como "Jornada Partida" en una sola fila, sumando horas y coste', () => {
    // Un trabajador que ficha, sale a comer y vuelve a fichar el mismo día:
    // dos turnos con el mismo startDate deben verse como un solo bloque en
    // Saldos & Acuerdos (aunque las horas totales del trabajador sí suman
    // ambos), con el rango de cada tramo guardado en `ranges`.
    const shifts = [
      { workerName: 'Ricardo', durationHours: 2, cost: 20, startDate: '10/09/2026', startTime: '08:00:00', endTime: '10:00:00' },
      { workerName: 'Ricardo', durationHours: 1, cost: 10, startDate: '10/09/2026', startTime: '15:00:00', endTime: '16:00:00' },
    ];
    const result = aggregateShiftsByWorker(shifts, workersList);
    expect(result.Ricardo.completedShifts).toBe(1);
    expect(result.Ricardo.totalHours).toBe(3);
    expect(result.Ricardo.totalCost).toBe(30);
    expect(result.Ricardo.shifts).toHaveLength(1);
    expect(result.Ricardo.shifts[0]).toMatchObject({
      durationHours: 3,
      cost: 30,
      endTime: '16:00:00', // se queda con el último tramo de salida
      ranges: ['08:00:00 a 10:00:00', '15:00:00 a 16:00:00'],
    });
  });

  it('ignora turnos de alguien que ya no está en workersList (huérfanos), sin romper', () => {
    const shifts = [{ workerName: 'Ex-trabajador', durationHours: 5, cost: 50 }];
    expect(() => aggregateShiftsByWorker(shifts, workersList)).not.toThrow();
    expect(Object.keys(aggregateShiftsByWorker(shifts, workersList))).toEqual(['Ricardo', 'Irene']);
  });
});

describe('isZombieShift', () => {
  it('un turno recién abierto no es zombi', () => {
    const now = new Date('2026-09-19T20:00:00.000Z');
    const entrada = { timestamp: '2026-09-19T19:00:00.000Z' }; // 1h abierto
    expect(isZombieShift(entrada, now)).toBe(false);
  });

  it('un turno de 15h abierto todavía no es zombi (dentro de lo normal en una boda larga)', () => {
    const now = new Date('2026-09-20T08:00:00.000Z');
    const entrada = { timestamp: '2026-09-19T17:00:00.000Z' }; // 15h abierto
    expect(isZombieShift(entrada, now)).toBe(false);
  });

  it('un turno abierto más de 16h es zombi (probable olvido de fichar salida)', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const entrada = { timestamp: '2026-09-19T19:00:00.000Z' }; // 17h abierto
    expect(isZombieShift(entrada, now)).toBe(true);
  });

  it('sin fichaje activo (null/undefined), no es zombi', () => {
    expect(isZombieShift(null)).toBe(false);
    expect(isZombieShift(undefined)).toBe(false);
    expect(isZombieShift({})).toBe(false); // sin timestamp
  });
});
