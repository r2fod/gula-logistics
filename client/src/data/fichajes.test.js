import { describe, it, expect } from 'vitest';
import { crearFichaje, horaDeFichaje, fechaDeFichaje, fichajesDeLaSemana } from './fichajes';

const trabajador = { name: 'Ana', role: 'Conductora', isPayroll: false, rate: 12 };
const fecha = new Date(2026, 8, 21, 9, 5, 7);

describe('crearFichaje', () => {
  it('rellena quién ficha, el tipo y la hora (ISO y en español, 24 h)', () => {
    const f = crearFichaje({ trabajador, tipo: 'entrada', fecha });
    expect(f).toMatchObject({
      workerName: 'Ana', role: 'Conductora', isPayroll: false, rate: 12, type: 'entrada',
      timestamp: fecha.toISOString(), timeFormatted: '09:05:07', dateFormatted: '21/9/2026',
    });
  });

  it('cada fichaje tiene su propio id', () => {
    const a = crearFichaje({ trabajador, tipo: 'entrada', fecha });
    const b = crearFichaje({ trabajador, tipo: 'entrada', fecha });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('sin fecha usa ahora', () => {
    const antes = Date.now();
    const f = crearFichaje({ trabajador, tipo: 'salida' });
    expect(new Date(f.timestamp).getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('sin tarifa propia, 10 €/h', () => {
    expect(crearFichaje({ trabajador: { ...trabajador, rate: undefined }, tipo: 'entrada' }).rate).toBe(10);
  });

  it('los campos de más se añaden y pueden pisar a los de base (id y tarifa del editor de admin)', () => {
    const f = crearFichaje({ trabajador, tipo: 'entrada', fecha, id: 'fijo', rate: 15, taskName: 'Carga', note: 'x', taskRef: { dayKey: 'martes', taskIndex: 0 } });
    expect(f).toMatchObject({ id: 'fijo', rate: 15, taskName: 'Carga', note: 'x', taskRef: { dayKey: 'martes', taskIndex: 0 } });
  });
});

describe('horaDeFichaje y fechaDeFichaje', () => {
  it('salen del timestamp, en español y 24 h', () => {
    const f = { timestamp: fecha.toISOString(), timeFormatted: 'x', dateFormatted: 'y' };
    expect(horaDeFichaje(f)).toBe('09:05:07');
    expect(fechaDeFichaje(f)).toBe('21/9/2026');
  });

  it('sin timestamp, o con uno ilegible, usan el texto guardado', () => {
    expect(horaDeFichaje({ timeFormatted: '10:00:00' })).toBe('10:00:00');
    expect(fechaDeFichaje({ dateFormatted: '1/1/2026' })).toBe('1/1/2026');
    expect(horaDeFichaje({ timestamp: 'no es una fecha', timeFormatted: '10:00:00' })).toBe('10:00:00');
  });

  it('un fichaje vacío no rompe', () => {
    expect(horaDeFichaje(undefined)).toBeUndefined();
    expect(fechaDeFichaje({})).toBeUndefined();
  });
});

describe('fichajesDeLaSemana — martes a martes, con el lunes de cola', () => {
  // Semana del 22 al 27 de septiembre de 2026 (martes a domingo) + lunes 28 de cola.
  const rango = { start: new Date(2026, 8, 22), end: new Date(2026, 8, 27) };
  const f = (id, fecha, type = 'entrada') => ({ id, type, timestamp: fecha.toISOString() });

  it('BUG evitado: el domingo por la mañana y el lunes de cola SÍ son de la semana (antes se cortaba el domingo a las 06:00)', () => {
    const domingo = f('d', new Date(2026, 8, 27, 10, 52));
    const lunes = f('l', new Date(2026, 8, 28, 17, 0));
    expect(fichajesDeLaSemana([domingo, lunes], rango)).toEqual([domingo, lunes]);
  });

  it('deja fuera lo de antes del martes y lo del martes siguiente', () => {
    const antes = f('a', new Date(2026, 8, 21, 23, 0));
    const martes = f('m', new Date(2026, 8, 22, 0, 0));
    const siguiente = f('s', new Date(2026, 8, 29, 0, 0));
    expect(fichajesDeLaSemana([antes, martes, siguiente], rango)).toEqual([martes]);
  });

  it('la entrada de un turno que sigue abierto se incluye aunque empezara antes', () => {
    const entradaDelLunesAnterior = f('abierta', new Date(2026, 8, 21, 22, 0));
    expect(fichajesDeLaSemana([entradaDelLunesAnterior], rango, [entradaDelLunesAnterior])).toEqual([entradaDelLunesAnterior]);
  });

  it('sin fechas legibles de la semana no filtra nada; un fichaje sin fecha legible queda fuera de una semana concreta', () => {
    const roto = { id: 'x', type: 'entrada', timestamp: 'nada' };
    expect(fichajesDeLaSemana([roto], null)).toEqual([roto]);
    expect(fichajesDeLaSemana([roto], rango)).toEqual([]);
  });
});
