import { describe, it, expect } from 'vitest';
import { fusionarSaldosConEquipo, buscarPorNombreDeSaldo } from './saldosEquipo';

const equipo = [
  { name: 'Persona2', role: 'Conductor', avatar: '🚛', isPayroll: false },
  { name: 'Persona4', role: 'Base', avatar: '👩', isPayroll: true },
  { name: 'Nuevo Fichaje', role: 'Apoyo', isPayroll: false },
];

describe('fusionarSaldosConEquipo', () => {
  const saldos = {
    updatedAt: 'x',
    workers: [
      { id: 'Persona2', name: 'Persona2 Gula', currentBalance: 125.5, breakdown: [{ concept: 'a' }] },
      { id: 'otro', name: 'Alguien que ya no está', currentBalance: 9 },
    ],
  };

  it('usa la ficha real aunque el nombre completo no coincida exactamente', () => {
    const { workers } = fusionarSaldosConEquipo(saldos, equipo);
    expect(workers[0].id).toBe('Persona2');
    expect(workers[0].currentBalance).toBe(125.5);
  });

  it('crea una ficha vacía, con su acuerdo por defecto, para quien no tiene', () => {
    const { workers } = fusionarSaldosConEquipo(saldos, equipo);
    expect(workers[1]).toMatchObject({ id: 'Persona4', currentBalance: 0, status: 'Sin saldo', agreements: ['Nómina Fija (Control interno)'] });
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
  const horas = { Persona2: { hours: 4 }, Persona4: { hours: 2 } };

  it('encuentra la entrada por el nombre completo de la ficha', () => {
    expect(buscarPorNombreDeSaldo(horas, 'Persona2 Gula')).toEqual({ hours: 4 });
  });

  it('devuelve null si no hay coincidencia o faltan datos', () => {
    expect(buscarPorNombreDeSaldo(horas, 'Luis Gula')).toBeNull();
    expect(buscarPorNombreDeSaldo(horas, '')).toBeNull();
    expect(buscarPorNombreDeSaldo(undefined, 'Persona2')).toBeNull();
  });
});
