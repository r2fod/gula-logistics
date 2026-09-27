import { describe, it, expect } from 'vitest';
import { repartirBolsa, aplicarTarifaDeBolsa, tieneBolsa } from './bolsaHoras';

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
