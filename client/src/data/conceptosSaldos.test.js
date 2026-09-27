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

describe('pagos (lo ya entregado al trabajador)', () => {
  it('reconoce los pagos: por su tipo guardado o, en los antiguos, por el texto y el signo', () => {
    expect(tipoDeConcepto({ concept: 'Lo que sea', amount: -50, tipo: 'pago' })).toBe('pago');
    expect(tipoDeConcepto({ concept: 'Pago en efectivo', amount: -100 })).toBe('pago');
    expect(tipoDeConcepto({ concept: 'Adelanto nómina', amount: -50 })).toBe('pago');
    expect(tipoDeConcepto({ concept: 'Pago Bizum', amount: -20 })).toBe('pago');
    expect(tipoDeConcepto({ concept: 'Rotura de copas', amount: -12 })).toBe('ajuste');
    expect(tipoDeConcepto({ concept: 'Pago pendiente de horas', amount: 30 })).toBe('ajuste'); // positivo: no es un pago hecho
    expect(tipoDeConcepto({ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h + 10€ transporte)', amount: 45 })).toBe('turno');
  });

  it('BUG evitado: los pagos no cuentan como coste (antes restaban del "coste apuntado a mano")', () => {
    const conPagos = [{ name: 'Ana', statusType: 'success', breakdown: [
      { concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 },
      { concept: 'Pago en efectivo', amount: -100 },
      { concept: 'Rotura', amount: -5 },
    ] }];
    const r = conceptosDelPeriodo(conPagos, { desde: null, hasta: null }, { ahora });
    expect(r.total).toBe(30); // 35 - 5: el pago no es coste
    expect(r.pagado).toBe(100);
    expect(r.porTipo.pago).toEqual({ importe: -100, conceptos: 1 });
  });

  it('la fecha guardada manda: un pago de hoy entra en su semana aunque el texto no la lleve', () => {
    const fichasConFecha = [{ name: 'Ana', breakdown: [{ concept: 'Pago en efectivo', amount: -60, tipo: 'pago', date: '2026-09-23' }] }];
    const r = conceptosDelPeriodo(fichasConFecha, semana(22), { ahora });
    expect(r.pagado).toBe(60);
    expect(r.sinFechaFuera).toBe(0);
  });
});
