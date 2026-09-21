import { describe, it, expect } from 'vitest';
import { formatearNumero, formatearEuros, formatearHoras, formatearCantidad, formatearEurosConSigno, formatearPorcentaje } from './formatoFinanciero';

describe('formatoFinanciero', () => {
  it('importes con coma decimal y punto de millares, también de 4 cifras', () => {
    expect(formatearEuros(2025)).toBe('2.025,00 €');
    expect(formatearEuros(617.5)).toBe('617,50 €');
    expect(formatearEuros(1234567.891)).toBe('1.234.567,89 €');
    expect(formatearEuros(0)).toBe('0,00 €');
  });

  it('un valor no numérico se muestra como cero, no como NaN', () => {
    expect(formatearEuros(NaN)).toBe('0,00 €');
    expect(formatearEuros(undefined)).toBe('0,00 €');
    expect(formatearHoras(Infinity)).toBe('0 h');
  });

  it('un negativo lleva signo, salvo si se redondea a cero', () => {
    expect(formatearEuros(-45.5)).toBe('-45,50 €');
    expect(formatearNumero(-0.001)).toBe('0,00');
  });

  it('horas sin ceros de sobra', () => {
    expect(formatearHoras(3.5)).toBe('3,5 h');
    expect(formatearHoras(242.5)).toBe('242,5 h');
    expect(formatearHoras(12)).toBe('12 h');
    expect(formatearHoras(0.75)).toBe('0,75 h');
    expect(formatearHoras(57.5833333)).toBe('57,58 h');
    expect(formatearHoras(1234.5)).toBe('1.234,5 h');
  });

  it('porcentajes con un decimal', () => {
    expect(formatearPorcentaje(36.4)).toBe('36,4 %');
    expect(formatearPorcentaje(100)).toBe('100,0 %');
    expect(formatearPorcentaje(12.345, 0)).toBe('12 %');
  });
});

describe('formatearCantidad', () => {
  it('sin ceros de sobra ni unidad, con coma decimal', () => {
    expect(formatearCantidad(12)).toBe('12');
    expect(formatearCantidad(3.5)).toBe('3,5');
    expect(formatearCantidad(0.75)).toBe('0,75');
    expect(formatearCantidad(1234.5)).toBe('1.234,5');
  });

  it('redondea a dos decimales y tolera valores raros', () => {
    expect(formatearCantidad(2.0049)).toBe('2');
    expect(formatearCantidad(NaN)).toBe('0');
    expect(formatearCantidad(undefined)).toBe('0');
    expect(formatearCantidad(-1.5)).toBe('-1,5');
  });
});

describe('formatearEurosConSigno', () => {
  it('pone el signo explícito: + para cero y positivos, - para negativos', () => {
    expect(formatearEurosConSigno(125.5)).toBe('+125,50 €');
    expect(formatearEurosConSigno(0)).toBe('+0,00 €');
    expect(formatearEurosConSigno(-30)).toBe('-30,00 €');
    expect(formatearEurosConSigno(1234.5)).toBe('+1.234,50 €');
  });
});
