import { describe, it, expect } from 'vitest';
import { pairShiftsFromEntries } from './shiftCalculations';
import { claveDia, hayFiltros, filtrarFichajes, agruparPorDia, turnosPorSalida, contarPorTipo, personasDe } from './fichajesAgrupados';

let n = 0;
const f = (workerName, type, fecha, taskName = 'Tarea', extra = {}) => ({ id: `f${++n}`, workerName, type, timestamp: fecha.toISOString(), taskName, isPayroll: false, rate: 10, ...extra });
const d = (dia, h, m = 0) => new Date(2026, 8, dia, h, m);

// Ana: dos turnos (uno el 19 que acaba de madrugada, otro el 20). Luis: un turno el 20.
const entradas = [
  f('Ana', 'entrada', d(19, 20, 0), 'JORNADA'),
  f('Ana', 'salida', d(20, 1, 0), 'Jornada Operativa', { note: 'Finalizada tarea' }),
  f('Ana', 'entrada', d(20, 9, 0), 'JORNADA'),
  f('Ana', 'salida', d(20, 13, 0), 'Jornada Operativa'),
  f('Luis', 'entrada', d(20, 10, 0), 'Recogida Álamos'),
  f('Luis', 'salida', d(20, 12, 0), 'Recogida Álamos'),
];
const { shifts } = pairShiftsFromEntries(entradas);

describe('filtrarFichajes', () => {
  it('sin filtros devuelve todo; hayFiltros lo sabe', () => {
    expect(filtrarFichajes(entradas)).toHaveLength(6);
    expect(hayFiltros({})).toBe(false);
    expect(hayFiltros({ consulta: '  ' })).toBe(false);
    expect(hayFiltros({ tipo: 'salida' })).toBe(true);
  });

  it('por tipo y por persona', () => {
    expect(filtrarFichajes(entradas, { tipo: 'salida' })).toHaveLength(3);
    expect(filtrarFichajes(entradas, { persona: 'Luis' })).toHaveLength(2);
    expect(filtrarFichajes(entradas, { persona: 'Luis', tipo: 'entrada' })).toHaveLength(1);
  });

  it('el texto busca en nombre, tarea y nota sin distinguir mayúsculas ni acentos', () => {
    expect(filtrarFichajes(entradas, { consulta: 'alamos' })).toHaveLength(2); // "Álamos"
    expect(filtrarFichajes(entradas, { consulta: 'FINALIZADA' })).toHaveLength(1); // en la nota
    expect(filtrarFichajes(entradas, { consulta: 'luis' })).toHaveLength(2);
    expect(filtrarFichajes(entradas, { consulta: 'nada que ver' })).toHaveLength(0);
  });
});

describe('agruparPorDia', () => {
  it('del día más reciente al más antiguo, y cronológico dentro de cada día', () => {
    const g = agruparPorDia(entradas, shifts);
    expect(g.map(x => x.clave)).toEqual(['2026-9-20', '2026-9-19']);
    const horas = g[0].entradas.map(e => new Date(e.timestamp).getHours());
    expect(horas).toEqual([1, 9, 10, 12, 13]);
  });

  it('las horas de un turno cuentan en el día en que EMPIEZA, aunque acabe de madrugada', () => {
    const g = agruparPorDia(entradas, shifts);
    const dia19 = g.find(x => x.clave === '2026-9-19');
    const dia20 = g.find(x => x.clave === '2026-9-20');
    expect(dia19.horas).toBe(5); // 20:00 -> 01:00
    expect(dia19.turnos).toBe(1);
    expect(dia20.horas).toBe(4 + 2); // Ana 9-13 + Luis 10-12
    expect(dia20.turnos).toBe(2);
  });

  it('un fichaje sin fecha legible no rompe nada y va al final', () => {
    const roto = { id: 'x', workerName: 'Ana', type: 'entrada', timestamp: 'nada' };
    const g = agruparPorDia([...entradas, roto], shifts);
    expect(claveDia(roto)).toBe('sin-fecha');
    expect(g[g.length - 1].clave).toBe('sin-fecha');
    expect(g[g.length - 1].fecha).toBeNull();
  });
});

describe('utilidades', () => {
  it('turnosPorSalida enlaza cada salida con el turno que cierra', () => {
    const mapa = turnosPorSalida(shifts);
    const salidaLuis = entradas.find(e => e.workerName === 'Luis' && e.type === 'salida');
    expect(mapa[salidaLuis.id].durationHours).toBe(2);
    expect(Object.keys(mapa)).toHaveLength(3);
  });

  it('contarPorTipo y personasDe', () => {
    expect(contarPorTipo(entradas)).toEqual({ todos: 6, entrada: 3, salida: 3, fichaje: 0 });
    expect(personasDe(entradas)).toEqual(['Ana', 'Luis']);
  });
});
