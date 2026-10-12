import { describe, it, expect } from 'vitest';
import { fichajesACambiarDeTarifa, tarifaDe, tarifaEnFichaDeSaldos } from './tarifas';

// Horas locales (como las ve quien ficha), sin depender de la zona de la máquina.
const a = (dia, hora, minuto = 0) => new Date(2026, 9, dia, hora, minuto).toISOString();
const f = (id, workerName, type, timestamp, extra = {}) => ({ id, workerName, type, timestamp, rate: 10, ...extra });

describe('tarifaDe', () => {
  it('la de su ficha; sin ella, 14 en nómina fija y 10 el resto', () => {
    expect(tarifaDe({ rate: 12 })).toBe(12);
    expect(tarifaDe({ isPayroll: true })).toBe(14);
    expect(tarifaDe({})).toBe(10);
    expect(tarifaDe(undefined)).toBe(10);
  });
});

describe('fichajesACambiarDeTarifa', () => {
  const fichajes = [
    f('e1', 'Luis', 'entrada', a(1, 9)), f('s1', 'Luis', 'salida', a(1, 14)),
    f('e2', 'Luis', 'entrada', a(4, 10)), f('s2', 'Luis', 'salida', a(4, 17)),
    f('e3', 'Luis', 'entrada', a(12, 15)), f('s3', 'Luis', 'salida', a(12, 20)),
    f('x1', 'Ana', 'entrada', a(4, 10)), f('x2', 'Ana', 'salida', a(4, 17)),
  ];

  it('solo los suyos desde ese día (incluido), no los de antes ni los de otra persona', () => {
    expect(fichajesACambiarDeTarifa(fichajes, 'Luis', '2026-10-04', 12).map(x => x.id)).toEqual(['e2', 's2', 'e3', 's3']);
    expect(fichajesACambiarDeTarifa(fichajes, 'Luis', '2026-10-05', 12).map(x => x.id)).toEqual(['e3', 's3']);
    expect(fichajesACambiarDeTarifa(fichajes, 'Luis', '2026-10-13', 12)).toEqual([]);
  });

  it('el nombre, sin mayúsculas ni acentos, pero nunca «lo contiene» (Mariana no es Ana)', () => {
    const lista = [f('m', 'Mariana', 'entrada', a(4, 10)), f('n', 'ANA', 'entrada', a(5, 10))];
    expect(fichajesACambiarDeTarifa(lista, 'Ana', '2026-10-01', 12).map(x => x.id)).toEqual(['n']);
  });

  it('no cuenta los de la papelera ni los que ya tienen esa tarifa (repetirlo no cambia nada)', () => {
    const lista = [f('a', 'Luis', 'entrada', a(4, 10), { deleted: true }), f('b', 'Luis', 'entrada', a(5, 10), { rate: 12 }), f('c', 'Luis', 'salida', a(5, 12))];
    expect(fichajesACambiarDeTarifa(lista, 'Luis', '2026-10-01', 12).map(x => x.id)).toEqual(['c']);
  });

  it('BUG evitado: la salida de madrugada de un turno que empezó el día anterior no cambia (subía el turno entero)', () => {
    const lista = [f('e', 'Luis', 'entrada', a(3, 22)), f('s', 'Luis', 'salida', a(4, 2)), f('e2', 'Luis', 'entrada', a(4, 18)), f('s2', 'Luis', 'salida', a(4, 23))];
    expect(fichajesACambiarDeTarifa(lista, 'Luis', '2026-10-04', 12).map(x => x.id)).toEqual(['e2', 's2']);
  });
});

describe('tarifaEnFichaDeSaldos', () => {
  it('lleva la tarifa a la ficha de Saldos y a su acuerdo «Extra a X € / hora», sin tocar los demás', () => {
    const ficha = { hourlyRate: 10, agreements: ['Extra a 10,00 € / hora (Por Defecto)', 'Ayuda de transporte'] };
    const cambios = tarifaEnFichaDeSaldos(ficha, 12);
    expect(cambios).toEqual({ hourlyRate: 12, agreements: ['Extra a 12,00 € / hora', 'Ayuda de transporte'] });
    // Y otra vez encima de lo ya cambiado.
    expect(tarifaEnFichaDeSaldos({ ...ficha, ...cambios }, 12.5).agreements[0]).toBe('Extra a 12,50 € / hora');
  });

  it('una ficha sin acuerdos solo recibe la tarifa', () => {
    expect(tarifaEnFichaDeSaldos({}, 12)).toEqual({ hourlyRate: 12, agreements: [] });
  });
});
