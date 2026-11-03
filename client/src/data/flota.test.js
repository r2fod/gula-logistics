import { describe, it, expect } from 'vitest';
import { esRecado, camionesParaElegir, flotaSinRecados } from './flota';

describe('flota: recados fuera de los vehículos', () => {
  it('BUG evitado: «recoger furgo…» o «X recoger 105 sillas» eran recados y salían como camiones', () => {
    expect(esRecado('recoger furgo por la tarde, recoger generador produ')).toBe(true);
    expect(esRecado('Boda Ana recoger 105 sillas')).toBe(true);
    expect(esRecado('Devolución Furgoneta A')).toBe(true);
    expect(esRecado('Traer mesas / Llevar cajas / Cargar y descargar')).toBe(true);
  });

  it('un vehículo con nombre normal no es un recado', () => {
    ['Camión Gula', 'Furgoneta B', 'Coche de Ana', 'Camión A'].forEach(n => expect(esRecado(n)).toBe(false));
  });

  it('BUG evitado: el selector no ofrece recados, salvo el que la tarea ya lleva', () => {
    const flota = [{ name: 'Camión A' }, { name: 'recoger furgo por la tarde' }, { name: 'Furgoneta B' }];
    expect(camionesParaElegir(flota)).toEqual(['Camión A', 'Furgoneta B']);
    expect(camionesParaElegir(flota, 'recoger furgo por la tarde')).toEqual(['Camión A', 'recoger furgo por la tarde', 'Furgoneta B']);
  });

  it('flotaSinRecados los quita y tolera una flota vacía', () => {
    expect(flotaSinRecados([{ name: 'Camión A' }, { name: 'devolver furgo' }])).toEqual([{ name: 'Camión A' }]);
    expect(flotaSinRecados(undefined)).toEqual([]);
  });
});
