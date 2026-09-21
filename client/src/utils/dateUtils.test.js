import { describe, it, expect } from 'vitest';
import { formatDuration } from './dateUtils';

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
