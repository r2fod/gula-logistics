import { describe, it, expect } from 'vitest';
import { tipoDeConcepto, fechaDeConcepto, conceptosDelPeriodo, horasDeConcepto, llevaFechaAparte, conFecha, diasSugeridos } from './conceptosSaldos';
import { rangoDePeriodo } from './periodosFinancieros';

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

describe('BUG evitado: la fecha 30/09 que puso la migración del servidor no es real', () => {
  const ref = new Date(2026, 9, 3, 12, 0);
  const iso = (f) => f && `${f.getDate()}/${f.getMonth() + 1}`;

  it('un apunte antiguo (sin tipo) vuelve a la fecha de su texto; uno apuntado de verdad el 30/09 se queda', () => {
    expect(iso(fechaDeConcepto({ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35, date: '2026-09-30' }, ref))).toBe('16/9');
    expect(fechaDeConcepto({ concept: 'Rotura de copas', amount: -10, date: '2026-09-30' }, ref)).toBeNull();
    expect(iso(fechaDeConcepto({ concept: 'Bizum', amount: -50, date: '2026-09-30', tipo: 'pago' }, ref))).toBe('30/9');
    expect(fechaDeConcepto({ concept: 'Valor Acumulado Horas Bolsa (40h a 8€/h)', amount: 320, date: '2026-09-30', tipo: 'bolsa' }, ref)).toBeNull();
  });

  it('BUG evitado: sin fecha (también la bolsa, acuerdo de septiembre) cuentan en septiembre de 2026 y en su año, nunca en una semana; antes la bolsa solo salía en «Todo»', () => {
    const fichas = [{ name: 'Ana', statusType: 'success', breakdown: [
      { concept: 'Saldo inicial', amount: 100, date: '2026-09-30' }, // antiguo, fecha de la migración
      { concept: 'Valor Acumulado Horas Bolsa (40h a 8€/h)', amount: 320, tipo: 'bolsa' },
      { concept: 'Bizum', amount: -50, date: '2026-09-30', tipo: 'pago' },
    ] }];
    const total = (modo, ancla) => conceptosDelPeriodo(fichas, rangoDePeriodo(modo, ancla), { incluirSinFecha: modo === 'todo', ahora: ref }).total;
    expect(total('semana', new Date(2026, 8, 30))).toBe(0); // antes: 420, todo en la semana del 29/09
    expect(total('mes', new Date(2026, 8, 30))).toBe(420);
    expect(total('mes', new Date(2026, 9, 2))).toBe(0);
    expect(total('anio', new Date(2026, 8, 30))).toBe(420);
    expect(total('todo', ref)).toBe(420);
    expect(conceptosDelPeriodo(fichas, rangoDePeriodo('semana', new Date(2026, 8, 30)), { ahora: ref }).pagado).toBe(50); // el pago es de verdad del 30/09
  });
});

describe('horasDeConcepto', () => {
  it('lee las horas de un turno o de la bolsa a mano, también con coma decimal; 0 en lo demás', () => {
    expect(horasDeConcepto({ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 })).toBe(3.5);
    expect(horasDeConcepto({ concept: '🕒 16/09 (17:00 a 20:30 - 3,5h a 10€/h)', amount: 35 })).toBe(3.5); // antes: 5
    expect(horasDeConcepto({ concept: 'Valor Acumulado Horas Bolsa (42h a 8€/h)', amount: 336 })).toBe(42);
    expect(horasDeConcepto({ concept: '🕒 23/09 — 10€ ayuda transporte', amount: 10 })).toBe(0);
    expect(horasDeConcepto({ concept: 'Rotura de 3 copas', amount: -12 })).toBe(0);
  });
});

describe('la fecha de un concepto a mano', () => {
  it('va aparte en transporte, ajustes y pagos; no en un turno a mano (su texto la dice) ni en la bolsa acumulada', () => {
    expect(llevaFechaAparte({ concept: 'Transporte', amount: 10 })).toBe(true);
    expect(llevaFechaAparte({ concept: 'Efectivo', amount: -50, tipo: 'pago' })).toBe(true);
    expect(llevaFechaAparte({ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 })).toBe(false);
    expect(llevaFechaAparte({ concept: '🕒 23/09 — 10€ ayuda transporte', amount: 10 })).toBe(false);
    expect(llevaFechaAparte({ concept: 'Valor Acumulado Horas Bolsa (42h a 8€/h)', amount: 336 })).toBe(false);
  });

  it('cambiarla conserva lo demás y fija el tipo', () => {
    expect(conFecha({ concept: 'Efectivo', amount: -50 }, '2026-10-04')).toEqual({ concept: 'Efectivo', amount: -50, date: '2026-10-04', tipo: 'pago' });
    expect(conFecha({ concept: 'Transporte', amount: 10, tipo: 'ajuste', date: '2026-10-01' }, '2026-10-04')).toMatchObject({ tipo: 'ajuste', date: '2026-10-04' });
  });

  it('BUG evitado: a un apunte antiguo (sin tipo) se le puede poner el 30/09, la fecha que una migración puso a todos y que se ignora', () => {
    const viejo = { concept: 'Transporte', amount: 10, date: '2026-09-30' };
    expect(fechaDeConcepto(viejo)).toBeNull();
    expect(fechaDeConcepto(conFecha(viejo, '2026-09-30'))).toEqual(new Date(2026, 8, 30));
  });
});

describe('diasSugeridos (al poner fecha a un apunte)', () => {
  const ahora = new Date(2026, 9, 13);
  const turno = (mes, dia, hora = 9) => ({ startEntry: { timestamp: new Date(2026, mes, dia, hora).toISOString() } });
  const turnos = [turno(8, 17), turno(8, 20), turno(8, 20, 18), turno(8, 28), turno(9, 4), turno(9, 12)];
  const sinFecha = { concept: 'Transporte', amount: 10 };
  const conDia = { concept: 'Transporte', amount: 10, tipo: 'ajuste', date: '2026-10-12' };
  const ficha = { breakdown: [{ concept: '🕒 13/09 (08:00 a 15:00 - 7h a 10€/h + 10€ transporte)', amount: 80 }, sinFecha, conDia, { concept: 'Efectivo', amount: -50, tipo: 'pago', date: '2026-10-01' }] };

  it('a un apunte sin fecha (de antes del 28/09) le propone los días que trabajó hasta entonces: fichados y turnos a mano, sin repetir', () => {
    expect(diasSugeridos(sinFecha, ficha, turnos, ahora)).toEqual(['2026-09-13', '2026-09-17', '2026-09-20', '2026-09-28']);
  });

  it('a uno que ya tiene día le propone todos los trabajados (para corregirlo); un pago o un ajuste no cuentan como día trabajado', () => {
    expect(diasSugeridos(conDia, ficha, turnos, ahora)).toEqual(['2026-09-13', '2026-09-17', '2026-09-20', '2026-09-28', '2026-10-04', '2026-10-12']);
  });

  it('sin turnos no propone nada; a uno sin fecha, todos los de septiembre; a uno con día, los 8 últimos', () => {
    expect(diasSugeridos(sinFecha, { breakdown: [sinFecha] }, [], ahora)).toEqual([]);
    const septiembre = Array.from({ length: 12 }, (_, i) => turno(8, i + 13));
    expect(diasSugeridos(sinFecha, { breakdown: [sinFecha] }, septiembre, ahora)).toHaveLength(12);
    const muchos = Array.from({ length: 12 }, (_, i) => turno(9, i + 1));
    expect(diasSugeridos(conDia, { breakdown: [conDia] }, muchos, ahora)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
  });
});
