import { describe, it, expect } from 'vitest';
import { normalizarNombre, coincideNombre } from './nombresTrabajadores';

describe('normalizarNombre', () => {
  it('quita espacios, pasa a minúsculas y unifica la doble f', () => {
    expect(normalizarNombre('  Jefferson Gula ')).toBe('jeferson gula');
  });

  it('tolera valores vacíos', () => {
    expect(normalizarNombre(undefined)).toBe('');
    expect(normalizarNombre(null)).toBe('');
  });
});

describe('coincideNombre', () => {
  it('cruza el nombre corto del equipo con el completo de la ficha', () => {
    expect(coincideNombre('Ricardo', 'Ricardo Gula')).toBe(true);
  });

  it('acepta el nombre igual y sin importar mayúsculas', () => {
    expect(coincideNombre('Irene', 'irene')).toBe(true);
  });

  it('cruza el typo histórico Jeferson / Jefferson', () => {
    expect(coincideNombre('Jeferson', 'Jefferson Gula')).toBe(true);
  });

  it('no mezcla a personas distintas', () => {
    expect(coincideNombre('Ana', 'Luis Gula')).toBe(false);
  });

  it('un nombre vacío no coincide con nada (evita cruzar todo con todos)', () => {
    expect(coincideNombre('', 'Ricardo Gula')).toBe(false);
    expect(coincideNombre('Ricardo', '')).toBe(false);
  });
});
