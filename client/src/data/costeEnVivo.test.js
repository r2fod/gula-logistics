import { describe, it, expect } from 'vitest';
import { costeEnCurso, duracionEnCurso, enCursoDelPeriodo } from './costeEnVivo';

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

describe('enCursoDelPeriodo', () => {
  const semana = { desde: new Date(2026, 8, 22), hasta: new Date(2026, 8, 29) };
  const abierto = (workerName, h, extra = {}) => ({ workerName, type: 'entrada', timestamp: a(h).toISOString(), ...extra });

  it('suma lo que llevan los turnos abiertos del periodo: extras aparte de nómina', () => {
    const equipo = [{ name: 'Ana', isPayroll: false }, { name: 'Luis', isPayroll: true }];
    const r = enCursoDelPeriodo([abierto('Ana', 9, { rate: 10 }), abierto('Luis', 10, { rate: 14, isPayroll: true })], semana, { ahora: a(11), equipo });
    expect(r).toEqual({ turnos: 2, horas: 3, extras: 20, nomina: 14 });
  });

  it('lo que empezó fuera del periodo no cuenta; sin límites (todo el histórico), sí', () => {
    const lunesPasado = { workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 21, 23, 0).toISOString(), rate: 10 };
    expect(enCursoDelPeriodo([lunesPasado], semana, { ahora: new Date(2026, 8, 22, 1, 0) }).turnos).toBe(0);
    expect(enCursoDelPeriodo([lunesPasado], {}, { ahora: new Date(2026, 8, 22, 1, 0) }).extras).toBe(20);
  });

  it('un turno abierto más de 16 h (salida olvidada) no se suma', () => {
    expect(enCursoDelPeriodo([abierto('Ana', 0, { rate: 10 })], semana, { ahora: new Date(2026, 8, 28, 17, 0) }).turnos).toBe(0);
  });

  it('sin tarifa en el fichaje, 10 €/h de extra (14 si es de nómina), como al emparejar turnos', () => {
    expect(enCursoDelPeriodo([abierto('Eva', 9)], semana, { ahora: a(10) }).extras).toBe(10);
    expect(enCursoDelPeriodo([abierto('Eva', 9, { isPayroll: true })], semana, { ahora: a(10) }).nomina).toBe(14);
  });

  it('con bolsa, gasta primero lo que queda contando sus turnos ya cerrados', () => {
    const fichas = [{ name: 'Ana', isSpecialPurse: true, purseInfo: { totalHours: 10, consumedHours: 6, hourlyRate: 8, extraRateAfter80h: 12 } }];
    const turnos = [{ workerName: 'Ana', durationHours: 3 }, { workerName: 'Luis', durationHours: 50 }];
    // quedan 10 - 6 - 3 = 1 h de bolsa: 1 h a 8 + 1 h a 12
    expect(enCursoDelPeriodo([abierto('Ana', 9)], semana, { ahora: a(11), fichas, turnos }).extras).toBe(20);
  });
});
