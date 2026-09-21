import { describe, it, expect } from 'vitest';
import { formatearNumero, formatearEuros, formatearHoras, formatearPorcentaje } from './formatoFinanciero';

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
