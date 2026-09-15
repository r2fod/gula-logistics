import { describe, it, expect } from 'vitest';
import { getTaskListForDay, resolveTaskIndexByText, buildTaskListPatch } from './taskPlanning';

const weekData = {
  schedule: {
    martes: { tasks: [{ text: 'Cargar furgoneta', completed: false }, 'Recoger sillas'] },
  },
  sundayMonday: {
    title: 'Domingo 20 & Lunes 21',
    tasks: [{ text: 'Devolver Dealde', completed: false }, { text: 'Recogida en Refranys', completed: true }],
  },
};

describe('getTaskListForDay', () => {
  it('para "domingo" devuelve sundayMonday.tasks, no schedule.domingo (que no existe)', () => {
    expect(getTaskListForDay(weekData, 'domingo')).toBe(weekData.sundayMonday.tasks);
  });

  it('para un día normal devuelve schedule[dayKey].tasks', () => {
    expect(getTaskListForDay(weekData, 'martes')).toBe(weekData.schedule.martes.tasks);
  });

  it('devuelve [] si el día no existe en el planning, sin lanzar', () => {
    expect(getTaskListForDay(weekData, 'miercoles')).toEqual([]);
    expect(getTaskListForDay(null, 'martes')).toEqual([]);
  });
});

describe('resolveTaskIndexByText', () => {
  it('encuentra el índice real de una tarea de domingo por su texto', () => {
    expect(resolveTaskIndexByText(weekData, 'domingo', 'Recogida en Refranys')).toBe(1);
  });

  it('encuentra el índice de una tarea de texto plano (no objeto) en un día normal', () => {
    expect(resolveTaskIndexByText(weekData, 'martes', 'Recoger sillas')).toBe(1);
  });

  it('devuelve null si el texto no coincide con ninguna tarea', () => {
    expect(resolveTaskIndexByText(weekData, 'martes', 'Tarea inexistente')).toBeNull();
  });
});

describe('buildTaskListPatch', () => {
  it('para domingo, actualiza sundayMonday.tasks preservando el resto de sundayMonday (p.ej. title)', () => {
    const nuevaLista = [{ text: 'Devolver Dealde', completed: true }];
    const patch = buildTaskListPatch(weekData, 'domingo', nuevaLista);
    expect(patch).toEqual({ sundayMonday: { title: 'Domingo 20 & Lunes 21', tasks: nuevaLista } });
  });

  it('para un día normal, actualiza solo schedule[dayKey].tasks sin tocar otros días', () => {
    const nuevaLista = [{ text: 'Cargar furgoneta', completed: true }];
    const patch = buildTaskListPatch(weekData, 'martes', nuevaLista);
    expect(patch.schedule.martes.tasks).toEqual(nuevaLista);
    // No debe perder otros días que pudiera haber en schedule (aquí solo hay martes, pero la key debe conservarse).
    expect(Object.keys(patch.schedule)).toEqual(['martes']);
  });
});
