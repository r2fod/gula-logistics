import { describe, it, expect } from 'vitest';
import { tipoDeConcepto, fechaDeConcepto, conceptosDelPeriodo } from './conceptosSaldos';

const ahora = new Date(2026, 8, 28, 12, 0);
const fichas = [
  { name: 'Ana', statusType: 'success', breakdown: [
    { concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 },
    { concept: '🕒 23/09 — 10€ ayuda transporte', amount: 10 },
    { concept: 'Rotura de 3 copas', amount: -12 },
  ] },
  { name: 'Eva', statusType: 'success', breakdown: [{ concept: 'Valor Acumulado Horas Bolsa (6h a 8€/h)', amount: 48 }] },
  { name: 'Luis', statusType: 'payroll', breakdown: [{ concept: '🕒 16/09 (9:00 a 14:00 - 5h a 14€/h)', amount: 70 }] },
];
const semana = (d) => ({ desde: new Date(2026, 8, d), hasta: new Date(2026, 8, d + 7) });

describe('tipoDeConcepto y fechaDeConcepto', () => {
  it('clasifica los conceptos a mano', () => {
    expect(tipoDeConcepto('🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)')).toBe('turno');
    expect(tipoDeConcepto('🕒 16/09 — 10€ ayuda transporte')).toBe('transporte');
    expect(tipoDeConcepto('Valor Acumulado Horas Bolsa (6h a 8€/h)')).toBe('bolsa');
    expect(tipoDeConcepto('Adelanto')).toBe('ajuste');
  });

  it('lee la fecha sin año como la más reciente que no esté en el futuro', () => {
    expect(fechaDeConcepto('🕒 16/09 (…)', ahora)).toEqual(new Date(2026, 8, 16));
    expect(fechaDeConcepto('🕒 20/12 (…)', ahora)).toEqual(new Date(2025, 11, 20)); // diciembre aún no ha llegado
    expect(fechaDeConcepto('Rotura', ahora)).toBeNull();
    expect(fechaDeConcepto('🕒 31/02 (…)', ahora)).toBeNull();
  });
});

describe('conceptosDelPeriodo', () => {
  it('en una semana solo entran los conceptos con fecha de esa semana (y nunca los de nómina fija)', () => {
    const r = conceptosDelPeriodo(fichas, semana(15), { ahora });
    expect(r.items.map(i => i.concepto)).toEqual(['🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)']);
    expect(r.porTipo).toEqual({ turno: { importe: 35, conceptos: 1 } });
    expect(r.sinFechaFuera).toBe(2); // la rotura y la bolsa no se pueden colocar en una semana
  });

  it('en "Todo" entra todo lo del personal extra, también lo que no tiene fecha', () => {
    const r = conceptosDelPeriodo(fichas, { desde: null, hasta: null }, { ahora });
    expect(r.total).toBe(35 + 10 - 12 + 48);
    expect(r.porTipo.ajuste).toEqual({ importe: -12, conceptos: 1 });
    expect(r.porTipo.bolsa.importe).toBe(48);
    expect(r.sinFechaFuera).toBe(0);
  });

  it('tolera fichas sin desglose o con importes raros', () => {
    expect(conceptosDelPeriodo([{ name: 'X' }, { name: 'Y', breakdown: [{ concept: 'a', amount: 'no' }] }], null).total).toBe(0);
    expect(conceptosDelPeriodo(undefined, null).items).toEqual([]);
  });
});
