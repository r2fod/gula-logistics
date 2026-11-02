import { describe, it, expect } from 'vitest';
import { afterEach, vi } from 'vitest';
import { costeEnCurso, duracionEnCurso, enCursoDelPeriodo, prepararEnCurso, sumarEnCurso, tarifaDelTurno } from './costeEnVivo';
import { saldoDeTrabajador } from './saldoTrabajador';
import { pairShiftsFromEntries } from './shiftCalculations';
import { crearFichaje } from './fichajes';
import { tarifasPorDefecto, usarTarifasPorDefecto } from './tarifasPorDefecto';

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
    expect(costeEnCurso({ entrada, ahora: a(11), ficha, turnosPrevios: [{ durationHours: 3, startEntry: { timestamp: new Date(2026, 8, 27, 9).toISOString() } }] }).coste).toBe(20);
  });

  it('BUG evitado: sin tope de 14 h (como al cerrar; antes se perdían horas reales); entrada rara = 0', () => {
    expect(costeEnCurso({ entrada, ahora: a(23, 30), tarifa: 10 })).toEqual({ horas: 14.5, coste: 145 });
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

describe('costeEnCurso con la bolsa por meses', () => {
  // Bolsa de 10 h a 8 €/h, luego 12 €/h; acuerdo de septiembre a octubre; 10 h a mano en septiembre.
  const ficha = { isSpecialPurse: true, purseInfo: { totalHours: 10, consumedHours: 10, hourlyRate: 8, extraRateAfter80h: 12, desde: '2026-09', hasta: '2026-10' } };
  const turnoDe = (mes, dia, horas) => ({ durationHours: horas, startEntry: { timestamp: new Date(2026, mes, dia, 9).toISOString() } });

  it('en un mes nuevo del acuerdo vuelve a gastar bolsa, contando solo lo fichado ese mes', () => {
    const enOctubre = { timestamp: new Date(2026, 9, 5, 9).toISOString() };
    const previos = [turnoDe(8, 20, 30), turnoDe(9, 2, 8)]; // 30 h de septiembre no cuentan; 8 h de octubre sí
    // quedan 10 - 8 = 2 h de bolsa: 2 h a 8 + 1 h a 12
    expect(costeEnCurso({ entrada: enOctubre, ahora: new Date(2026, 9, 5, 12), ficha, turnosPrevios: previos }).coste).toBe(28);
  });

  it('pasado el acuerdo, todo a la tarifa extra', () => {
    const enNoviembre = { timestamp: new Date(2026, 10, 3, 9).toISOString() };
    expect(costeEnCurso({ entrada: enNoviembre, ahora: new Date(2026, 10, 3, 11), ficha }).coste).toBe(24);
  });
});


describe('enCursoDelPeriodo: la ficha de cada uno', () => {
  it('BUG evitado: el turno abierto de "Ana" usa la bolsa de su ficha "Ana Gula" (antes no la encontraba y cobraba a tarifa normal)', () => {
    const semana = { desde: new Date(2026, 8, 22), hasta: new Date(2026, 8, 29) };
    const fichas = [{ name: 'Mariana Gula' }, { name: 'Ana Gula', isSpecialPurse: true, purseInfo: { totalHours: 10, consumedHours: 0, hourlyRate: 8, extraRateAfter80h: 12 } }];
    const equipo = [{ name: 'Ana' }, { name: 'Mariana' }];
    const abiertoAna = { workerName: 'Ana', type: 'entrada', timestamp: a(9).toISOString(), rate: 10 };
    expect(enCursoDelPeriodo([abiertoAna], semana, { ahora: a(11), equipo, fichas }).extras).toBe(16); // 2 h de bolsa a 8 €/h
    const abiertoMariana = { ...abiertoAna, workerName: 'Mariana' };
    expect(enCursoDelPeriodo([abiertoMariana], semana, { ahora: a(11), equipo, fichas }).extras).toBe(20); // sin bolsa
  });
});

describe('costeEnCurso sin tarifa', () => {
  it('sin tarifa no inventa ninguna: 0 (antes 10 por defecto en el código)', () => {
    expect(costeEnCurso({ entrada, ahora: a(10) })).toEqual({ horas: 1, coste: 0 });
  });
});

describe('prepararEnCurso + sumarEnCurso', () => {
  it('da lo mismo que enCursoDelPeriodo (lo de cada segundo es solo la suma)', () => {
    const semana = { desde: new Date(2026, 8, 22), hasta: new Date(2026, 8, 29) };
    const equipo = [{ name: 'Ana', isPayroll: false }, { name: 'Luis', isPayroll: true }];
    const abiertos = [
      { workerName: 'Ana', type: 'entrada', timestamp: a(9).toISOString(), rate: 10 },
      { workerName: 'Luis', type: 'entrada', timestamp: a(10).toISOString(), rate: 14, isPayroll: true },
    ];
    const preparados = prepararEnCurso(abiertos, semana, { equipo });
    [a(10), a(11, 30), a(12, 15, 9)].forEach(ahora => {
      expect(sumarEnCurso(preparados, ahora)).toEqual(enCursoDelPeriodo(abiertos, semana, { ahora, equipo }));
    });
  });
});

describe('tarifaDelTurno', () => {
  const antes = { ...tarifasPorDefecto() };
  afterEach(() => usarTarifasPorDefecto(antes));

  it('la del fichaje; sin ella, la de la persona; sin persona, la por defecto', () => {
    usarTarifasPorDefecto({ extra: 9, nomina: 13 });
    expect(tarifaDelTurno({ rate: 11 }, { rate: 12 })).toBe(11);
    expect(tarifaDelTurno({}, { rate: 12 })).toBe(12);
    expect(tarifaDelTurno({ isPayroll: true }, null)).toBe(13);
    expect(tarifaDelTurno(null, { rate: 12 })).toBe(12);
  });

  it('BUG evitado: el monitor, Saldos, el Resumen y la vista del trabajador dan la misma tarifa que lo que se cobra al cerrar (antes, con una entrada sin tarifa, el Resumen usaba la por defecto y el monitor la de la ficha)', () => {
    usarTarifasPorDefecto({ extra: 9, nomina: 13 });
    const persona = { name: 'Eva', role: 'Montaje', isPayroll: false, rate: 12 };
    // Entró cuando aún no tenía tarifa (ni suya ni por defecto); luego se la pusieron.
    const entradaSinTarifa = { ...crearFichaje({ trabajador: persona, tipo: 'entrada', fecha: a(9) }), rate: undefined };
    const salida = crearFichaje({ trabajador: persona, tipo: 'salida', fecha: a(11) });
    const cobrado = pairShiftsFromEntries([entradaSinTarifa, salida]).shifts[0].rate;
    expect(cobrado).toBe(12);

    // Monitor (LiveMonitorPanel) y vista del trabajador (LlevasGanado): tarifaDelTurno(entrada, persona).
    expect(tarifaDelTurno(entradaSinTarifa, persona)).toBe(cobrado);
    // Resumen Financiero: lo que suma en directo por hora.
    const semana = { desde: new Date(2026, 8, 22), hasta: new Date(2026, 8, 29) };
    expect(enCursoDelPeriodo([entradaSinTarifa], semana, { ahora: a(11), equipo: [persona] }).extras).toBe(cobrado * 2);
    // Saldos (con la tarifa de su ficha de Saldos). Mira si el turno es un olvido con la hora real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(a(11));
    const saldo = saldoDeTrabajador({ ficha: { name: 'Eva', hourlyRate: 12 }, abierto: entradaSinTarifa });
    expect(saldo.enCurso(a(11))).toBe(cobrado * 2);
    vi.useRealTimers();
  });
});
