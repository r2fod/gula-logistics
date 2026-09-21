import { describe, it, expect } from 'vitest';
import { crearFichaje, horaDeFichaje, fechaDeFichaje } from './fichajes';

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
