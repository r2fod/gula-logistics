import { describe, it, expect } from 'vitest';
import { normalizarNombre, coincideNombre, parecidoNombre, elMasParecido } from './nombresTrabajadores';

describe('normalizarNombre', () => {
  it('quita espacios, pasa a minúsculas y unifica la doble f', () => {
    expect(normalizarNombre('  Steffan Gula ')).toBe('stefan gula');
  });

  it('tolera valores vacíos', () => {
    expect(normalizarNombre(undefined)).toBe('');
    expect(normalizarNombre(null)).toBe('');
  });
});

describe('coincideNombre', () => {
  it('cruza el nombre corto del equipo con el completo de la ficha', () => {
    expect(coincideNombre('Marta', 'Marta Gula')).toBe(true);
  });

  it('acepta el nombre igual y sin importar mayúsculas', () => {
    expect(coincideNombre('Elena', 'elena')).toBe(true);
  });

  it('cruza las dos grafías de un nombre con doble f', () => {
    expect(coincideNombre('Stefan', 'Steffan Gula')).toBe(true);
  });

  it('no mezcla a personas distintas', () => {
    expect(coincideNombre('Ana', 'Luis Gula')).toBe(false);
  });

  it('un nombre vacío no coincide con nada (evita cruzar todo con todos)', () => {
    expect(coincideNombre('', 'Marta Gula')).toBe(false);
    expect(coincideNombre('Marta', '')).toBe(false);
  });
});

describe('nombres con tildes y la ficha que mejor encaja', () => {
  it('BUG evitado: "Sofía" en el equipo encuentra su ficha "Sofia Gula" (y al revés): su enlace salía sin saldo', () => {
    expect(coincideNombre('Sofía', 'Sofia Gula')).toBe(true);
    expect(coincideNombre('Jesus', 'Jesús')).toBe(true);
    expect(normalizarNombre('  Íñigo  Peña ')).toBe('inigo pena');
  });

  it('BUG evitado: "Ana" se queda con "Ana Gula" aunque "Mariana Gula" salga antes (antes, el primero que la contuviera)', () => {
    const fichas = [{ name: 'Mariana Gula' }, { name: 'Ana Gula' }];
    expect(elMasParecido(fichas, f => parecidoNombre('Ana', f.name))).toBe(fichas[1]);
    expect(elMasParecido(fichas, f => parecidoNombre('Mariana', f.name))).toBe(fichas[0]);
  });

  it('igual gana a "empieza por" y este a "lo contiene"; sin parecido, null', () => {
    expect(parecidoNombre('Luis', 'luis')).toBe(3);
    expect(parecidoNombre('Luis', 'Luis Gula')).toBe(2);
    expect(parecidoNombre('Luis', 'José Luis Gula')).toBe(1);
    expect(elMasParecido([{ name: 'Eva' }], f => parecidoNombre('Pau', f.name))).toBeNull();
  });
});
