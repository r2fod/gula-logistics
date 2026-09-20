import { describe, it, expect } from 'vitest';
import { buildWeekPrompt } from './geminiScheduleService';

const base = { weekName: 'Semana 4', dateRange: 'Del 22 al 27 de Septiembre de 2026', trucks: ['Camión Gula'], workers: ['Ana', 'Luis'] };
const dia = { martes: 'Martes 22', viernes: 'Viernes 25', sabado: 'Sábado 26' };
const dayLabel = (k) => dia[k] || k;

describe('buildWeekPrompt', () => {
  it('BUG evitado: una boda de viernes y dos eventos de martes llegan al prompt con su día', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [
        { day: 'viernes', kind: 'Boda', place: 'Finca Norte', time: '' },
        { day: 'martes', kind: 'Evento', place: 'Catering Uno', time: '20:00-23:00' },
        { day: 'martes', kind: 'Evento', place: 'Catering Dos', time: '' },
      ],
    });
    expect(p).toContain('- Martes 22: Evento — Catering Uno (20:00-23:00).');
    expect(p).toContain('- Martes 22: Evento — Catering Dos.');
    expect(p).toContain('- Viernes 25: Boda — Finca Norte.');
    // ordenados por día aunque se hayan añadido en otro orden
    expect(p.indexOf('Martes 22: Evento — Catering Uno')).toBeLessThan(p.indexOf('Viernes 25'));
  });

  it('sin eventos de sábado le dice a la IA que no genere bodas de sábado', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [{ day: 'martes', kind: 'Evento', place: 'X', time: '' }] });
    expect(p).toContain('El sábado no hay bodas esta semana');
  });

  it('con un evento de sábado no lo dice, y lo manda a saturdaySpecial.weddings', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [{ day: 'sabado', kind: 'Boda', place: 'Finca Sur', time: '' }] });
    expect(p).not.toContain('El sábado no hay bodas esta semana');
    expect(p).toContain('saturdaySpecial.weddings');
  });

  it('sin ningún evento lo indica y no inventa bodas', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [] });
    expect(p).toContain('No hay bodas ni eventos esta semana');
  });

  it('ignora filas con día desconocido y recorta espacios', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [{ day: 'nunca', kind: 'Boda', place: 'Fantasma' }, { day: 'martes', kind: 'Boda', place: '  Finca Real  ', time: ' 10:00 ' }],
    });
    expect(p).not.toContain('Fantasma');
    expect(p).toContain('Boda — Finca Real (10:00).');
  });
});
