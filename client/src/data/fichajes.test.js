import { describe, it, expect } from 'vitest';
import { crearFichaje, horaDeFichaje, fechaDeFichaje, fichajesDeLaSemana, ultimaModificacion, fusionarCambiosFichajes, quienFichaConEnlace } from './fichajes';

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

describe('sincronización por cambios', () => {
  const f = (id, updatedAt, extra = {}) => ({ id, updatedAt, workerName: 'Ana', type: 'entrada', timestamp: updatedAt, ...extra });

  it('ultimaModificacion: el updatedAt más reciente (los que no lo traen, fuera)', () => {
    expect(ultimaModificacion([f('a', '2026-09-28T10:00:00.000Z'), f('b', '2026-09-28T11:00:00.000Z'), { id: 'c' }])).toBe('2026-09-28T11:00:00.000Z');
    expect(ultimaModificacion([])).toBeNull();
  });

  it('sustituye lo que cambió (p. ej. un borrado), añade lo nuevo al principio y deja el resto', () => {
    const actuales = [f('a', '2026-09-28T10:00:00.000Z'), f('b', '2026-09-28T09:00:00.000Z')];
    const r = fusionarCambiosFichajes(actuales, [f('b', '2026-09-28T12:00:00.000Z', { deleted: true }), f('c', '2026-09-28T12:05:00.000Z')]);
    expect(r.map(x => x.id)).toEqual(['c', 'a', 'b']);
    expect(r.find(x => x.id === 'b').deleted).toBe(true);
  });

  it('si no cambia nada de verdad devuelve la MISMA lista (la pantalla no se recalcula)', () => {
    const actuales = [f('a', '2026-09-28T10:00:00.000Z')];
    expect(fusionarCambiosFichajes(actuales, [f('a', '2026-09-28T10:00:00.000Z')])).toBe(actuales);
    expect(fusionarCambiosFichajes(actuales, [])).toBe(actuales);
  });

  it('un fichaje hecho en este móvil (aún sin updatedAt) se sustituye por el del servidor', () => {
    const local = { id: 'x', workerName: 'Ana', type: 'entrada', timestamp: '2026-09-28T10:00:00.000Z' };
    const r = fusionarCambiosFichajes([local], [f('x', '2026-09-28T10:00:01.000Z')]);
    expect(r).toHaveLength(1);
    expect(r[0].updatedAt).toBe('2026-09-28T10:00:01.000Z');
  });
});

describe('quienFichaConEnlace', () => {
  const ahora = new Date('2026-10-03T12:00:00Z');
  const f = (workerName, dia, firmado, extra = {}) => ({ workerName, timestamp: `2026-${dia}T08:00:00Z`, firmado, ...extra });

  it('manda el último fichaje marcado de cada uno; los antiguos sin marca y la papelera no cuentan', () => {
    const r = quienFichaConEnlace([
      f('Ana', '10-01', false), f('Ana', '10-02', true), // ya usa su enlace
      f('Luis', '10-02', false),
      f('Eva', '10-02', undefined), // de antes de la marca
      f('Pau', '10-02', false, { deleted: true }),
      f('Sara', '09-01', false), // hace más de 14 días
    ], ahora);
    expect(r).toEqual({ conEnlace: ['Ana'], sinEnlace: ['Luis'] });
  });
});

describe('fichajesDeLaSemana — semana del cambio de hora (25/10/2026)', () => {
  it('BUG evitado: lo fichado el lunes de cola entre las 23:00 y las 24:00 está en su semana (antes, en ninguna)', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'Europe/Madrid';
    try {
      const semana = { start: new Date(2026, 9, 20) }; // martes 20 de octubre
      const siguiente = { start: new Date(2026, 9, 27) };
      const tarde = { id: 't', type: 'salida', timestamp: new Date(2026, 9, 26, 23, 30).toISOString() }; // lunes 26, 23:30
      expect(fichajesDeLaSemana([tarde], semana)).toEqual([tarde]);
      expect(fichajesDeLaSemana([tarde], siguiente)).toEqual([]);
    } finally {
      process.env.TZ = tzAntes;
    }
  });
});
