import { describe, it, expect } from 'vitest';
import { saldoDeTrabajador } from './saldoTrabajador';

const hace = (horas, desde = new Date(2026, 8, 30, 12, 0)) => new Date(desde.getTime() - horas * 3600000).toISOString();
const ahora = new Date(2026, 8, 30, 12, 0);
const horas = { totalHours: 5, shifts: [{ durationHours: 3, cost: 30 }, { durationHours: 2, cost: 20 }] };

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
});
