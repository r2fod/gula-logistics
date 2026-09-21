import { describe, it, expect } from 'vitest';
import { inicioSemanaOperativa, rangoDePeriodo, moverPeriodo, turnosDelPeriodo, semanasDelPeriodo } from './periodosFinancieros';

const d = (y, m, dia, h = 0, min = 0) => new Date(y, m - 1, dia, h, min);
const turno = (fecha) => ({ startEntry: { timestamp: fecha.toISOString() } });

describe('inicioSemanaOperativa — la semana va de martes a lunes', () => {
  it('cualquier día de la semana 15–21 de septiembre de 2026 da el martes 15', () => {
    [d(2026, 9, 15), d(2026, 9, 18, 13), d(2026, 9, 20, 23, 59), d(2026, 9, 21, 16)].forEach(f => {
      expect(inicioSemanaOperativa(f)).toEqual(d(2026, 9, 15));
    });
  });

  it('el martes siguiente ya es otra semana', () => {
    expect(inicioSemanaOperativa(d(2026, 9, 22, 0, 1))).toEqual(d(2026, 9, 22));
  });
});

describe('rangoDePeriodo', () => {
  const semanas = { a: { name: 'Semana 3', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' } } };

  it('semana: del martes al lunes siguiente, con el nombre de la semana del planning', () => {
    const r = rangoDePeriodo('semana', d(2026, 9, 19), semanas);
    expect(r.desde).toEqual(d(2026, 9, 15));
    expect(r.hasta).toEqual(d(2026, 9, 22)); // excluido: el lunes 21 entra
    expect(r.etiqueta).toContain('Semana 3');
    expect(r.etiqueta).toContain('2026');
  });

  it('una semana sin planning solo lleva las fechas', () => {
    expect(rangoDePeriodo('semana', d(2026, 9, 30), semanas).etiqueta).not.toContain('Semana 3');
  });

  it('un borrador no da nombre a la semana', () => {
    const borrador = { a: { name: 'Semana 4', meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Borrador' } } };
    expect(rangoDePeriodo('semana', d(2026, 9, 23), borrador).etiqueta).not.toContain('Semana 4');
  });

  it('mes y año son los naturales', () => {
    const mes = rangoDePeriodo('mes', d(2026, 9, 21));
    expect([mes.desde, mes.hasta]).toEqual([d(2026, 9, 1), d(2026, 10, 1)]);
    expect(mes.etiqueta.toLowerCase()).toContain('septiembre');
    const anio = rangoDePeriodo('anio', d(2026, 9, 21));
    expect([anio.desde, anio.hasta]).toEqual([d(2026, 1, 1), d(2027, 1, 1)]);
    expect(anio.etiqueta).toBe('2026');
  });

  it('todo no tiene límites', () => {
    expect(rangoDePeriodo('todo')).toMatchObject({ desde: null, hasta: null });
  });
});

describe('moverPeriodo', () => {
  it('avanza y retrocede una semana, un mes o un año (también al cambiar de año)', () => {
    expect(moverPeriodo('semana', d(2026, 9, 19), 1)).toEqual(d(2026, 9, 26));
    expect(moverPeriodo('semana', d(2026, 9, 19), -1)).toEqual(d(2026, 9, 12));
    expect(moverPeriodo('mes', d(2026, 12, 15), 1)).toEqual(d(2027, 1, 1));
    expect(moverPeriodo('mes', d(2026, 1, 31), -1)).toEqual(d(2025, 12, 1));
    expect(moverPeriodo('anio', d(2026, 5, 5), -1)).toEqual(d(2025, 1, 1));
  });

  it('mover una semana desde el lunes de cola cae en la semana anterior, no en un hueco', () => {
    const lunes = d(2026, 9, 21);
    expect(inicioSemanaOperativa(moverPeriodo('semana', lunes, -1))).toEqual(d(2026, 9, 8));
  });
});

describe('turnosDelPeriodo', () => {
  const dentro = turno(d(2026, 9, 19, 20, 30)); // boda del sábado, acaba de madrugada
  const cola = turno(d(2026, 9, 21, 11, 51)); // lunes de cola
  const siguiente = turno(d(2026, 9, 22, 7, 0)); // martes: otra semana
  const shifts = [dentro, cola, siguiente];

  it('un turno cuenta en el periodo en que empieza', () => {
    const semana = rangoDePeriodo('semana', d(2026, 9, 19));
    expect(turnosDelPeriodo(shifts, semana)).toEqual([dentro, cola]);
  });

  it('la semana y el mes no se pisan ni pierden turnos entre sí', () => {
    const enMes = turnosDelPeriodo(shifts, rangoDePeriodo('mes', d(2026, 9, 1)));
    const enSemanas = [d(2026, 9, 15), d(2026, 9, 22)].flatMap(a => turnosDelPeriodo(shifts, rangoDePeriodo('semana', a)));
    expect(enSemanas).toHaveLength(shifts.length);
    expect(enMes).toHaveLength(shifts.length);
  });

  it('el 1 de octubre a las 00:00 es de octubre y a las 23:59 del 30 aún de septiembre', () => {
    const tarde = turno(d(2026, 9, 30, 23, 59));
    const primero = turno(d(2026, 10, 1, 0, 0));
    expect(turnosDelPeriodo([tarde, primero], rangoDePeriodo('mes', d(2026, 9, 1)))).toEqual([tarde]);
    expect(turnosDelPeriodo([tarde, primero], rangoDePeriodo('mes', d(2026, 10, 1)))).toEqual([primero]);
  });

  it('"todo" devuelve todos, también los de fecha ilegible; en un periodo concreto esos no entran', () => {
    const roto = { startEntry: { timestamp: 'no es una fecha' } };
    expect(turnosDelPeriodo([...shifts, roto], rangoDePeriodo('todo'))).toHaveLength(4);
    expect(turnosDelPeriodo([...shifts, roto], rangoDePeriodo('anio', d(2026, 1, 1)))).toHaveLength(3);
  });
});

describe('semanasDelPeriodo', () => {
  const s3 = { meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' } };
  const s4 = { meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' } };
  const s6 = { meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' } };
  const semanas = { s3, s4, s6, rara: { meta: { dateRange: 'fechas raras' } } };

  it('en una semana solo entra la del planning que empieza en ella (los pax no se mezclan con otra semana)', () => {
    expect(Object.keys(semanasDelPeriodo(semanas, rangoDePeriodo('semana', d(2026, 9, 19)), d(2026, 9, 21)))).toEqual(['s3']);
  });

  it('en un mes entran las que empiezan en él; en "todo", todas', () => {
    expect(Object.keys(semanasDelPeriodo(semanas, rangoDePeriodo('mes', d(2026, 9, 1)), d(2026, 9, 21)))).toEqual(['s3', 's4']);
    expect(Object.keys(semanasDelPeriodo(semanas, rangoDePeriodo('todo')))).toHaveLength(4);
  });
});
