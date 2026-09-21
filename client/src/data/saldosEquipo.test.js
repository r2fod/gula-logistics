import { describe, it, expect } from 'vitest';
import { fusionarSaldosConEquipo, buscarPorNombreDeSaldo } from './saldosEquipo';

const equipo = [
  { name: 'Marta', role: 'Conductora', avatar: '🚛', isPayroll: false },
  { name: 'Elena', role: 'Base', avatar: '👩', isPayroll: true },
  { name: 'Nuevo Fichaje', role: 'Apoyo', isPayroll: false },
];

describe('fusionarSaldosConEquipo', () => {
  const saldos = {
    updatedAt: 'x',
    workers: [
      { id: 'marta', name: 'Marta Gula', currentBalance: 125.5, breakdown: [{ concept: 'a' }] },
      { id: 'otro', name: 'Alguien que ya no está', currentBalance: 9 },
    ],
  };

  it('usa la ficha real aunque el nombre completo no coincida exactamente', () => {
    const { workers } = fusionarSaldosConEquipo(saldos, equipo);
    expect(workers[0].id).toBe('marta');
    expect(workers[0].currentBalance).toBe(125.5);
  });

  it('crea una ficha vacía, con su acuerdo por defecto, para quien no tiene', () => {
    const { workers } = fusionarSaldosConEquipo(saldos, equipo);
    expect(workers[1]).toMatchObject({ id: 'elena', currentBalance: 0, status: 'Sin saldo', agreements: ['Nómina Fija (Control interno)'] });
    expect(workers[2]).toMatchObject({ id: 'nuevo-fichaje', avatar: '👤', agreements: ['Extra a 10,00 € / hora (Por Defecto)'], breakdown: [] });
  });

  it('solo devuelve a las personas del equipo actual y conserva el resto de campos', () => {
    const resultado = fusionarSaldosConEquipo(saldos, equipo);
    expect(resultado.workers).toHaveLength(3);
    expect(resultado.updatedAt).toBe('x');
  });

  it('tolera saldos sin datos', () => {
    expect(fusionarSaldosConEquipo(undefined, equipo).workers).toHaveLength(3);
    expect(fusionarSaldosConEquipo({}, [])).toEqual({ workers: [] });
  });
});

describe('buscarPorNombreDeSaldo', () => {
  const horas = { Marta: { hours: 4 }, Elena: { hours: 2 } };

  it('encuentra la entrada por el nombre completo de la ficha', () => {
    expect(buscarPorNombreDeSaldo(horas, 'Marta Gula')).toEqual({ hours: 4 });
  });

  it('devuelve null si no hay coincidencia o faltan datos', () => {
    expect(buscarPorNombreDeSaldo(horas, 'Luis Gula')).toBeNull();
    expect(buscarPorNombreDeSaldo(horas, '')).toBeNull();
    expect(buscarPorNombreDeSaldo(undefined, 'Marta')).toBeNull();
  });
});
