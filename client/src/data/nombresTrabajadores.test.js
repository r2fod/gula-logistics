import { describe, it, expect } from 'vitest';
import { normalizarNombre, coincideNombre } from './nombresTrabajadores';

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
