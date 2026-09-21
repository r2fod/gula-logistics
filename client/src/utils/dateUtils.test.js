import { describe, it, expect } from 'vitest';
import {
  formatDate, formatTime, formatTimeShort, formatDateLong, formatWeekdayDay,
  formatDayMonthShort, formatMonthYear, formatWeekdayShort, formatMonthShort, formatDuration,
  formatWeekdayDayMonth, formatWeekdayShortDay,
} from './dateUtils';

// Fecha local (no UTC) para que el resultado no dependa de la zona horaria de quien ejecuta.
const fecha = new Date(2026, 8, 21, 9, 5, 7); // lunes 21/09/2026 09:05:07

describe('dateUtils', () => {
  it('fecha corta y horas en 24 h, con y sin segundos', () => {
    expect(formatDate(fecha)).toBe('21/9/2026');
    expect(formatTime(fecha)).toBe('09:05:07');
    expect(formatTimeShort(fecha)).toBe('09:05');
  });

  it('acepta una fecha ISO o un objeto Date, y devuelve vacío si no hay fecha', () => {
    expect(formatTime(fecha.toISOString())).toBe(formatTime(fecha));
    expect(formatDate(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTimeShort('')).toBe('');
  });

  it('formatos largos en español', () => {
    expect(formatDateLong(fecha)).toBe('lunes, 21 de septiembre de 2026');
    expect(formatWeekdayDay(fecha)).toBe('lunes 21');
    expect(formatMonthYear(fecha)).toBe('septiembre de 2026');
    expect(formatWeekdayDayMonth(fecha)).toBe('lunes, 21 de septiembre');
  });

  it('abreviaturas sin el punto', () => {
    expect(formatDayMonthShort(fecha)).toBe('21 sept');
    expect(formatWeekdayShort(fecha)).toBe('lun');
    expect(formatMonthShort(fecha)).toBe('sept');
    expect(formatWeekdayShortDay(fecha)).toBe('lun 21');
  });
});

describe('formatDuration', () => {
  it('minutos, horas exactas y horas con minutos', () => {
    expect(formatDuration(45 * 60000)).toBe('45 min');
    expect(formatDuration(2 * 3600000)).toBe('2 h');
    expect(formatDuration((2 * 60 + 10) * 60000)).toBe('2 h 10 min');
  });

  it('redondea al minuto y aguanta valores raros', () => {
    expect(formatDuration(89 * 1000)).toBe('1 min');
    expect(formatDuration(-5000)).toBe('0 min');
    expect(formatDuration(NaN)).toBe('0 min');
    expect(formatDuration(undefined)).toBe('0 min');
  });
});
