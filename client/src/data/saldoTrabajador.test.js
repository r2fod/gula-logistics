import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saldoDeTrabajador } from './saldoTrabajador';

const ahora = new Date(2026, 8, 30, 12, 0);
const hace = (horas) => new Date(ahora.getTime() - horas * 3600000).toISOString();
const horas = { totalHours: 5, shifts: [{ durationHours: 3, cost: 30 }, { durationHours: 2, cost: 20 }] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ahora);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('saldoDeTrabajador (la misma cuenta en Saldos y en la vista del trabajador)', () => {
  it('apuntado a mano (con los pagos restando) + turnos fichados', () => {
    const s = saldoDeTrabajador({ ficha: { currentBalance: -15 }, horas });
    expect(s.fichado).toBe(50);
    expect(s.cerrado).toBe(35);
    expect(s.cobraEnDirecto).toBe(false);
    expect(s.enCurso(ahora)).toBe(0);
  });

  it('con bolsa de horas, los fichados se pagan con su regla (bolsa y luego extra)', () => {
    const ficha = { currentBalance: 0, isSpecialPurse: true, purseInfo: { totalHours: 4, consumedHours: 0, hourlyRate: 8, extraRateAfter80h: 12 } };
    const s = saldoDeTrabajador({ ficha, horas });
    expect(s.costes.map(c => c.coste)).toEqual([24, 1 * 8 + 1 * 12]);
    expect(s.cerrado).toBe(44);
  });

  it('el turno abierto suma en directo; más de 16 h abierto (salida olvidada) no suma', () => {
    const abierto = { timestamp: hace(2), rate: 10 };
    const s = saldoDeTrabajador({ ficha: { currentBalance: 5, hourlyRate: 10 }, horas: null, abierto });
    expect(s.cobraEnDirecto).toBe(true);
    expect(s.cerrado + s.enCurso(ahora)).toBeCloseTo(25);
    const olvidado = saldoDeTrabajador({ ficha: { currentBalance: 5 }, abierto: { timestamp: hace(20), rate: 10 } });
    expect(olvidado.olvidado).toBe(true);
    expect(olvidado.enCurso(ahora)).toBe(0);
  });

  it('en nómina fija no cobra en directo', () => {
    const s = saldoDeTrabajador({ ficha: { currentBalance: 0, statusType: 'payroll' }, abierto: { timestamp: hace(2), rate: 14 } });
    expect(s.enNomina).toBe(true);
    expect(s.enCurso(ahora)).toBe(0);
  });

  it('con el acuerdo por meses, los turnos de un mes nuevo gastan su propia bolsa y el turno abierto sigue la misma cuenta', () => {
    const dia = (mes, d) => ({ timestamp: new Date(2026, mes, d, 9).toISOString() });
    const ficha = {
      currentBalance: 0, isSpecialPurse: true,
      purseInfo: { totalHours: 4, consumedHours: 4, hourlyRate: 8, extraRateAfter80h: 12, desde: '2026-09', hasta: '2026-10' },
    };
    const turnos = { totalHours: 8, shifts: [
      { durationHours: 2, cost: 20, startEntry: dia(8, 25) }, // septiembre: bolsa llena a mano → extra
      { durationHours: 3, cost: 30, startEntry: dia(9, 1) }, // octubre: 3 h de bolsa
      { durationHours: 3, cost: 30, startEntry: dia(9, 2) }, // 1 h de bolsa + 2 h extra
    ] };
    const s = saldoDeTrabajador({ ficha, horas: turnos, abierto: { timestamp: new Date(2026, 9, 3, 9).toISOString(), rate: 10 } });
    expect(s.costes.map(c => c.coste)).toEqual([24, 24, 8 + 24]);
    // Abierto en octubre con la bolsa de octubre ya gastada: 2 h a 12.
    expect(s.enCurso(new Date(2026, 9, 3, 11))).toBe(24);
  });
});

