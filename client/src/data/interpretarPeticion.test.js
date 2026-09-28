import { describe, it, expect } from 'vitest';
import { interpretarDisponibilidad } from './interpretarPeticion';

const equipo = [{ name: 'Tomás' }, { name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }, { name: 'Pau' }];
const leer = (texto) => (interpretarDisponibilidad(texto, equipo) || []).map(({ persona, dia, tipo, desde, hasta }) => [persona, dia, tipo, desde, hasta].filter(Boolean).join(' '));

describe('interpretarDisponibilidad (sin Gemini, 0 tokens)', () => {
  it('no puede / descansa un día', () => {
    expect(leer('Tomás no puede el jueves')).toEqual(['Tomás jueves no']);
    expect(leer('Ana descansa el sábado.')).toEqual(['Ana sabado descansa']);
    expect(leer('Luis está de vacaciones toda la semana')).toEqual(['Luis semana no']);
  });

  it('solo en un horario', () => {
    expect(leer('Luis solo puede de 9 a 14 el viernes')).toEqual(['Luis viernes solo 09:00 14:00']);
    expect(leer('Eva solo de 8:30 a 13 el miércoles')).toEqual(['Eva miercoles solo 08:30 13:00']);
    expect(leer('Pau hasta las 13 el lunes')).toEqual(['Pau lunes solo 06:00 13:00']);
    expect(leer('Ana a partir de las 16 el martes')).toEqual(['Ana martes solo 16:00 23:59']);
  });

  it('por la mañana / por la tarde', () => {
    expect(leer('Eva no puede el martes por la tarde')).toEqual(['Eva martes solo 06:00 14:00']);
    expect(leer('Tomás solo por la mañana el jueves')).toEqual(['Tomás jueves solo 06:00 14:00']);
    expect(leer('Luis no puede el viernes por la mañana')).toEqual(['Luis viernes solo 14:00 23:59']);
  });

  it('grupos de días: de lunes a viernes, entre semana, el fin de semana, en plural', () => {
    const entreSemana = ['martes', 'miercoles', 'jueves', 'viernes', 'lunes'];
    expect(leer('Luis solo puede a partir de las 15:00 de lunes a viernes')).toEqual(entreSemana.map(d => `Luis ${d} solo 15:00 23:59`));
    expect(leer('Pau no puede entre semana')).toEqual(entreSemana.map(d => `Pau ${d} no`));
    expect(leer('Eva descansa el fin de semana')).toEqual(['Eva sabado descansa', 'Eva domingo descansa']);
    expect(leer('Ana no puede los sábados')).toEqual(['Ana sabado no']);
    expect(leer('Tomás no puede de viernes a domingo')).toEqual(['Tomás viernes no', 'Tomás sabado no', 'Tomás domingo no']);
  });

  it('varias personas y varios días', () => {
    expect(leer('Ana y Luis no pueden el jueves ni el viernes')).toEqual(['Ana jueves no', 'Ana viernes no', 'Luis jueves no', 'Luis viernes no']);
  });

  it('si no lo tiene claro, no inventa (se le pasa a Gemini)', () => {
    expect(interpretarDisponibilidad('Pon a Luis en la carga del jueves', equipo)).toBeNull();
    expect(interpretarDisponibilidad('Tomás no puede el jueves, pon a Luis en su lugar', equipo)).toBeNull();
    expect(interpretarDisponibilidad('Alguien no puede el jueves', equipo)).toBeNull();
    expect(interpretarDisponibilidad('Tomás no puede', equipo)).toBeNull();
    expect(interpretarDisponibilidad('Tomás solo puede el jueves', equipo)).toBeNull();
    expect(interpretarDisponibilidad('Reorganiza las cargas del miércoles', equipo)).toBeNull();
  });
});
