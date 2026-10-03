import { describe, it, expect } from 'vitest';
import { comprobarSemana } from './checklistSemana';

const semana = (extra = {}) => ({
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' },
  schedule: { martes: { tasks: [] }, miercoles: { tasks: [] }, jueves: { tasks: [] }, viernes: { tasks: [] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [] },
  events: [],
  ...extra,
});
const tarea = (extra = {}) => ({ id: 'm1', text: 'Boda Ana - Carga', timeFrame: '09:00 - 11:00', assigned: ['Ana'], ...extra });

describe('comprobarSemana', () => {
  it('una semana bien hecha no da avisos', () => {
    const s = semana({ schedule: { ...semana().schedule, martes: { tasks: [tarea()] } }, events: [{ name: 'Boda Ana', pax: 120 }] });
    expect(comprobarSemana(s, [{ name: 'Ana' }])).toEqual([]);
  });

  it('avisa de tareas sin nadie, sin horario y eventos sin pax; las desactivadas y las hechas no cuentan', () => {
    const s = semana({
      schedule: { ...semana().schedule, martes: { tasks: [
        tarea({ assigned: [] }),
        tarea({ id: 'm2', text: 'Recoger mesas', timeFrame: '' }),
        tarea({ id: 'm3', assigned: [], active: false }),
        tarea({ id: 'm4', assigned: [], completed: true }),
      ] } },
      events: [{ name: 'Boda Ana' }],
    });
    expect(comprobarSemana(s, [{ name: 'Ana' }])).toEqual([
      'Martes: Boda Ana - Carga — sin nadie asignado.',
      'Martes: Recoger mesas — sin horario («HH:MM - HH:MM»).',
      'Boda Ana — sin pax: su coste compartido se repartirá a partes iguales.',
    ]);
  });
});
