import { describe, it, expect } from 'vitest';
import { normalizarNombre, coincideNombre } from './nombresTrabajadores';

describe('normalizarNombre', () => {
  it('quita espacios, pasa a minúsculas y unifica la doble f', () => {
    expect(normalizarNombre('  Persona5 Gula ')).toBe('Persona5 gula');
  });

  it('tolera valores vacíos', () => {
    expect(normalizarNombre(undefined)).toBe('');
    expect(normalizarNombre(null)).toBe('');
  });
});

describe('coincideNombre', () => {
  it('cruza el nombre corto del equipo con el completo de la ficha', () => {
    expect(coincideNombre('Persona2', 'Persona2 Gula')).toBe(true);
  });

  it('acepta el nombre igual y sin importar mayúsculas', () => {
    expect(coincideNombre('Persona4', 'Persona4')).toBe(true);
  });

  it('cruza el typo histórico Persona5 / Persona5', () => {
    expect(coincideNombre('Persona5', 'Persona5 Gula')).toBe(true);
  });

  it('no mezcla a personas distintas', () => {
    expect(coincideNombre('Ana', 'Luis Gula')).toBe(false);
  });

  it('un nombre vacío no coincide con nada (evita cruzar todo con todos)', () => {
    expect(coincideNombre('', 'Persona2 Gula')).toBe(false);
    expect(coincideNombre('Persona2', '')).toBe(false);
  });
});
