import { describe, expect, it } from 'vitest';
import { LogisticsWeek } from '../models/LogisticsWeek.model.js';
import { cambiosDeNumeracion } from './numeracionSemanas.js';

const semana = (weekId, name, archivada = false) => ({ weekId, name, archivada });

describe('numeración de semanas', () => {
  it('reserva el número pedido y empuja la cadena sin mover números tras el primer hueco', () => {
    const semanas = [semana('a', 'Semana 4 · Eventos'), semana('b', 'Semana 5'), semana('c', 'Semana 8')];
    expect(cambiosDeNumeracion(semanas, 'c', 'Semana 4')).toEqual([
      ['c', 'Semana 4'], ['a', 'Semana 5 · Eventos'], ['b', 'Semana 6'],
    ]);
  });

  it('desplaza una semana que Mongo devuelve como documento de Mongoose', () => {
    const anterior = new LogisticsWeek({ weekId: 'week_a', name: 'Semana 4' });
    expect(cambiosDeNumeracion([anterior], 'week_nueva', 'Semana 4')).toEqual([
      ['week_nueva', 'Semana 4'], ['week_a', 'Semana 5'],
    ]);
  });

  it('repara duplicados en la cadena, respeta nombres libres e ignora las archivadas', () => {
    const semanas = [
      semana('a', 'Semana 4'), semana('b', 'Semana 4'), semana('c', 'Semana 6', true),
      semana('d', 'Evento 5'), semana('e', 'Semana 9'),
    ];
    expect(cambiosDeNumeracion(semanas, 'nueva', 'Semana 4')).toEqual([
      ['nueva', 'Semana 4'], ['a', 'Semana 5'], ['b', 'Semana 6'],
    ]);
    expect(cambiosDeNumeracion(semanas, 'e', 'Equipo A')).toEqual([['e', 'Equipo A']]);
  });

  it('permite que la última semana de la cadena tome el número que deja libre la editada', () => {
    const semanas = [semana('a', 'Semana 4'), semana('b', 'Semana 5'), semana('c', 'Semana 6')];
    expect(cambiosDeNumeracion(semanas, 'c', 'Semana 4')).toEqual([
      ['c', 'Semana 4'], ['a', 'Semana 5'], ['b', 'Semana 6'],
    ]);
  });
});
