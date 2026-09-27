import { describe, it, expect } from 'vitest';
import { costeEnCurso, duracionEnCurso } from './costeEnVivo';

const entrada = { timestamp: new Date(2026, 8, 28, 9, 0).toISOString() };
const a = (h, m = 0, s = 0) => new Date(2026, 8, 28, h, m, s);

describe('costeEnCurso', () => {
  it('sube con el tiempo a la tarifa del turno, sin redondear', () => {
    expect(costeEnCurso({ entrada, ahora: a(9, 30), tarifa: 10 })).toEqual({ horas: 0.5, coste: 5 });
    expect(costeEnCurso({ entrada, ahora: a(10, 0, 36), tarifa: 10 }).coste).toBeCloseTo(10.1);
  });

  it('con bolsa, como en Saldos: primero gasta lo que queda de bolsa (contando lo ya fichado) y luego a tarifa extra', () => {
    const ficha = { isSpecialPurse: true, purseInfo: { totalHours: 10, consumedHours: 6, hourlyRate: 8, extraRateAfter80h: 12 } };
    // quedan 10 - 6 - 3 (ya fichadas) = 1 h de bolsa: 1 h a 8 + 1 h a 12
    expect(costeEnCurso({ entrada, ahora: a(11), ficha, horasPrevias: 3 }).coste).toBe(20);
  });

  it('tope de 14 h (un olvido de fichar la salida no sube sin fin) y entrada rara = 0', () => {
    expect(costeEnCurso({ entrada, ahora: new Date(2026, 8, 29, 12), tarifa: 10 })).toEqual({ horas: 14, coste: 140 });
    expect(costeEnCurso({ entrada: { timestamp: 'x' } })).toEqual({ horas: 0, coste: 0 });
  });
});

describe('duracionEnCurso', () => {
  it('formatea horas, minutos y segundos', () => {
    expect(duracionEnCurso(entrada, a(11, 5, 9))).toBe('2h 05m 09s');
    expect(duracionEnCurso(entrada, a(8))).toBe('0h 00m 00s');
  });
});
