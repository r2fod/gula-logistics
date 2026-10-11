import { describe, it, expect } from 'vitest';
import { repartirBolsa, aplicarTarifaDeBolsa, tieneBolsa, bolsaDeFicha, estadoBolsa, mesConBolsa, mesDe } from './bolsaHoras';

// Bolsa de 10 h a 8 €/h; lo que pasa, a 12 €/h. Ya consumidas 6 h a mano.
const purseInfo = { totalHours: 10, consumedHours: 6, hourlyRate: 8, extraRateAfter80h: 12 };
const ficha = { name: 'Eva Gula', isSpecialPurse: true, purseInfo };

let n = 0;
const turno = (workerName, dia, horas, rate = 10) => ({
  id: `t${++n}`, workerName, durationHours: horas, cost: horas * rate, rate,
  startEntry: { timestamp: new Date(2026, 8, dia, 9, 0).toISOString() },
  subTasks: [{ taskName: 'A', durationHours: horas / 2, cost: (horas / 2) * rate }, { taskName: 'B', durationHours: horas / 2, cost: (horas / 2) * rate }],
});

describe('repartirBolsa', () => {
  it('gasta primero lo que queda de bolsa y el resto va a tarifa extra, en orden', () => {
    expect(repartirBolsa([3, 3], purseInfo)).toEqual([
      { horasBolsa: 3, horasExtra: 0, coste: 24 },
      { horasBolsa: 1, horasExtra: 2, coste: 8 + 24 },
    ]);
  });

  it('con la bolsa agotada todo es extra', () => {
    expect(repartirBolsa([2], { ...purseInfo, consumedHours: 10 })[0]).toEqual({ horasBolsa: 0, horasExtra: 2, coste: 24 });
  });
});

describe('aplicarTarifaDeBolsa', () => {
  it('BUG evitado: el Resumen cobraba a la tarifa del fichaje a quien tiene bolsa; ahora como Saldos (en orden cronológico, aunque lleguen desordenados)', () => {
    const tarde = turno('Eva', 16, 3);
    const pronto = turno('Eva', 15, 3);
    const otra = turno('Ana', 15, 4);
    const r = aplicarTarifaDeBolsa([tarde, otra, pronto], [ficha, { name: 'Ana', purseInfo: null }]);
    expect(r[2].cost).toBe(24); // el primero en el tiempo gasta bolsa
    expect(r[0].cost).toBe(32); // el segundo, 1 h de bolsa + 2 h extra
    expect(r[1]).toBe(otra); // sin bolsa: el mismo objeto, sin tocar
    expect(r[0].subTasks.map(s => s.cost)).toEqual([16, 16]); // el desglose suma lo mismo
    expect(r[0].rate).toBeCloseTo(32 / 3);
  });

  it('sin nadie con bolsa devuelve la misma lista', () => {
    const lista = [turno('Ana', 15, 2)];
    expect(aplicarTarifaDeBolsa(lista, [{ name: 'Ana' }])).toBe(lista);
    expect(aplicarTarifaDeBolsa(lista, undefined)).toBe(lista);
    expect(tieneBolsa({ isSpecialPurse: true })).toBe(false);
  });
});

// Acuerdo de dos meses (septiembre y octubre de 2026): 10 h de bolsa al mes a 8 €/h y
// luego 12 €/h; las 10 h de septiembre ya están apuntadas a mano (consumedHours).
const deDosMeses = { totalHours: 10, consumedHours: 10, hourlyRate: 8, extraRateAfter80h: 12, desde: '2026-09', hasta: '2026-10' };
const fichaPorMeses = { name: 'Eva', isSpecialPurse: true, purseInfo: deDosMeses };
const turnoMes = (workerName, mes, dia, horas) => ({
  id: `t${++n}`, workerName, durationHours: horas, cost: horas * 12, rate: 12,
  startEntry: { timestamp: new Date(2026, mes, dia, 9, 0).toISOString() },
});

describe('bolsa por meses (acuerdo con desde/hasta)', () => {
  it('BUG evitado: en octubre todo iba a la tarifa extra porque la bolsa se había llenado en septiembre; ahora cada mes del acuerdo empieza de cero', () => {
    const r = repartirBolsa([4, 6, 6, 3], deDosMeses, ['2026-09', '2026-10', '2026-10', '2026-11']);
    expect(r).toEqual([
      { horasBolsa: 0, horasExtra: 4, coste: 48 }, // septiembre: la bolsa ya la llenaron las horas a mano
      { horasBolsa: 6, horasExtra: 0, coste: 48 }, // octubre: bolsa nueva
      { horasBolsa: 4, horasExtra: 2, coste: 32 + 24 }, // se acaban las 10 h de octubre
      { horasBolsa: 0, horasExtra: 3, coste: 36 }, // noviembre: fuera del acuerdo
    ]);
  });

  it('sin desde/hasta, la bolsa única de siempre (no cambia nada)', () => {
    const { desde, hasta, ...sinMeses } = deDosMeses;
    expect(desde && hasta).toBeTruthy();
    expect(repartirBolsa([4, 6], sinMeses, ['2026-09', '2026-10']).map(r => r.horasBolsa)).toEqual([0, 0]);
    expect(repartirBolsa([4, 6], { ...sinMeses, consumedHours: 0 }, ['2026-09', '2026-10']).map(r => r.horasBolsa)).toEqual([4, 6]);
  });

  it('las horas de bolsa apuntadas a mano en otro mes (horasBolsa con fecha) gastan la bolsa de ese mes', () => {
    const ficha = { ...fichaPorMeses, breakdown: [{ concept: 'turno a mano', amount: 24, date: '2026-10-02', horasBolsa: 3 }, { concept: 'otro', amount: 5, date: '2026-10-03' }] };
    expect(bolsaDeFicha(ficha).aManoPorMes).toEqual({ '2026-10': 3 });
    expect(repartirBolsa([9], bolsaDeFicha(ficha), ['2026-10'])[0]).toEqual({ horasBolsa: 7, horasExtra: 2, coste: 56 + 24 });
  });

  it('un mes antes del acuerdo o sin fecha no tiene bolsa; sin `hasta` no se acaba', () => {
    expect(mesConBolsa(deDosMeses, '2026-08')).toBe(false);
    expect(mesConBolsa(deDosMeses, '')).toBe(false);
    expect(mesConBolsa({ ...deDosMeses, hasta: '' }, '2027-05')).toBe(true);
    expect(mesConBolsa({ totalHours: 10 }, '')).toBe(true); // sin meses: siempre
    expect(mesDe(new Date(2026, 9, 31, 23))).toBe('2026-10');
    expect(mesDe('x')).toBe('');
  });

  it('el Resumen cobra octubre con la bolsa de octubre y cada turno en su mes', () => {
    const sep = turnoMes('Eva', 8, 20, 5);
    const oct1 = turnoMes('Eva', 9, 2, 8);
    const oct2 = turnoMes('Eva', 9, 9, 4);
    const nov = turnoMes('Eva', 10, 4, 2);
    const r = aplicarTarifaDeBolsa([nov, oct2, sep, oct1], [fichaPorMeses]);
    expect(r.map(t => t.cost)).toEqual([24, 2 * 8 + 2 * 12, 60, 64]);
  });

  it('estadoBolsa: cuánto lleva gastado el mes (a mano + fichado) y si el acuerdo lo cubre', () => {
    const turnos = [turnoMes('Eva', 8, 20, 5), turnoMes('Eva', 9, 2, 8), turnoMes('Eva', 9, 9, 1.5)];
    expect(estadoBolsa(fichaPorMeses, turnos, new Date(2026, 9, 15))).toEqual({ mes: '2026-10', total: 10, gastadas: 9.5, libres: 0.5, cubierto: true, porMeses: true });
    expect(estadoBolsa(fichaPorMeses, turnos, new Date(2026, 8, 25))).toMatchObject({ mes: '2026-09', gastadas: 10, libres: 0 }); // 10 a mano + 5 fichadas: la bolsa no pasa de 10
    expect(estadoBolsa(fichaPorMeses, turnos, new Date(2026, 10, 2))).toMatchObject({ mes: '2026-11', total: 0, cubierto: false });
    // Sin meses: la bolsa única, con todo lo fichado.
    expect(estadoBolsa({ ...fichaPorMeses, purseInfo: purseInfo }, turnos)).toMatchObject({ mes: '', total: 10, gastadas: 10, libres: 0, porMeses: false });
  });
});


describe('la bolsa es de su persona', () => {
  it('BUG evitado: los turnos de "Ana" ya no gastan la bolsa de "Mariana Gula"', () => {
    const deAna = turno('Ana', 15, 3);
    const deMariana = turno('Mariana', 16, 3);
    const r = aplicarTarifaDeBolsa([deAna, deMariana], [{ name: 'Mariana Gula', isSpecialPurse: true, purseInfo }]);
    expect(r[0]).toBe(deAna); // sin tocar: Ana no tiene bolsa
    expect(r[1].cost).toBe(24); // Mariana gasta su bolsa desde el principio (4 h libres a 8 €/h: 3 h)
  });
});
