import { describe, it, expect } from 'vitest';
import { normalizarNombre, coincideNombre, parecidoNombre, elMasParecido, mismoNombre, fichaDePersona, personaDelFichaje } from './nombresTrabajadores';

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

describe('la ficha de cada persona, mirando a todo el equipo', () => {
  const fichas = [{ name: 'Mariana Gula' }, { name: 'Luis Gula' }];
  const equipo = ['Ana', 'Mariana', 'Luis'];

  it('BUG evitado: Ana sin ficha propia ya no se queda con la de Mariana (ni ve su dinero)', () => {
    expect(fichaDePersona('Ana', fichas, equipo)).toBeNull();
    expect(fichaDePersona('Mariana', fichas, equipo)).toBe(fichas[0]);
    expect(fichaDePersona('Luis', fichas, equipo)).toBe(fichas[1]);
  });

  it('mismoNombre solo ignora mayúsculas, tildes y espacios; personaDelFichaje admite el nombre seguido de más', () => {
    expect(mismoNombre(' sofia ', 'Sofía')).toBe(true);
    expect(mismoNombre('Ana', 'Mariana')).toBe(false);
    expect(personaDelFichaje(['Ana', 'Marta'], 'Marta Gula')).toBe('Marta');
    expect(personaDelFichaje(['Ana'], 'Mariana')).toBeNull();
  });
});
