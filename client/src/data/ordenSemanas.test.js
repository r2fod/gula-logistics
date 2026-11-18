import { describe, it, expect } from 'vitest';
import { semanasOrdenadas } from './ordenSemanas';

const semana = (name) => ({ name, meta: { week: name } });

describe('semanasOrdenadas', () => {
  it('ordena por el número de «Semana N», no por el orden en que llegan', () => {
    const mapa = { c: semana('Semana 10'), a: semana('Semana 2'), b: semana('Semana 3') };
    expect(semanasOrdenadas(mapa).map(([id]) => id)).toEqual(['a', 'b', 'c']);
  });

  it('tras renumerar (la 3 pasa a ser la 4), cada una queda en su sitio', () => {
    const mapa = { nueva: semana('Semana 3'), vieja: semana('Semana 4'), primera: semana('Semana 1') };
    expect(semanasOrdenadas(mapa).map(([, w]) => w.name)).toEqual(['Semana 1', 'Semana 3', 'Semana 4']);
  });

  it('las que no llevan número van al final, por nombre, y con el mismo número manda el id', () => {
    const mapa = { z: semana('Evento especial'), b: semana('Semana 5'), a: semana('Semana 5'), y: semana('Boda grande') };
    expect(semanasOrdenadas(mapa).map(([id]) => id)).toEqual(['a', 'b', 'y', 'z']);
  });

  it('usa meta.week si la semana no trae name y no toca el mapa de entrada', () => {
    const mapa = { b: { meta: { week: 'Semana 2' } }, a: { name: 'Semana 1' } };
    const copia = JSON.stringify(mapa);
    expect(semanasOrdenadas(mapa).map(([id]) => id)).toEqual(['a', 'b']);
    expect(JSON.stringify(mapa)).toBe(copia);
    expect(semanasOrdenadas(null)).toEqual([]);
  });
});
