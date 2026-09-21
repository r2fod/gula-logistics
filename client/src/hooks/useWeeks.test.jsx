import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const patch = vi.fn();
vi.mock('../data/apiService', () => ({
  saveWeeksToAPI: vi.fn().mockResolvedValue({ success: true }),
  patchTaskCompletionInAPI: (...args) => patch(...args),
}));

const { useWeeks } = await import('./useWeeks');

// Semana real de producción: martes 15 -> domingo 20, lunes 21 de cola.
const semana = () => ({
  id: 'week_3', name: 'Semana 3', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' },
  trucks: [], schedule: {}, saturdaySpecial: { weddings: [] },
  sundayMonday: { title: 'D/L', tasks: [
    { text: 'Devolución Generador', timeFrame: '09:30 - 10:00', targetDay: 'Lunes', assigned: ['Ana'], completed: false },
    { text: 'Recogida', timeFrame: '15:00-17:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false },
  ] },
});

const montar = () => {
  vi.stubGlobal('localStorage', {
    store: { gula_logistics_all_weeks_v10: JSON.stringify({ week_3: semana() }) },
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = v; },
    removeItem(k) { delete this.store[k]; },
  });
  return renderHook(() => useWeeks());
};

describe('useWeeks — marcar y desmarcar tareas', () => {
  beforeEach(() => { vi.useFakeTimers(); patch.mockReset(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('BUG evitado: pulsar una tarea que SE VE hecha por la hora la DESMARCA y queda reopened (antes la marcaba de verdad)', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 11, 0)); // 10:45 ya pasó -> se ve hecha
    const { result } = montar();
    act(() => result.current.toggleTask('domingo', 0));

    expect(patch).toHaveBeenCalledWith('week_3', 'domingo', 0, false, true);
    expect(result.current.activeWeek.sundayMonday.tasks[0]).toMatchObject({ completed: false, reopened: true });
  });

  it('BUG evitado: una tarea desmarcada a propósito NO se vuelve a marcar sola', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 11, 0));
    const { result } = montar();
    act(() => result.current.toggleTask('domingo', 0)); // desmarcar
    patch.mockReset();

    act(() => result.current.autoCompletePastTasks());
    expect(patch).not.toHaveBeenCalledWith('week_3', 'domingo', 0, true, false);
  });

  it('marcar de nuevo a mano vale y quita reopened', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 8, 0)); // aún no pasó su hora -> se ve pendiente
    const { result } = montar();
    act(() => result.current.toggleTask('domingo', 0));
    expect(patch).toHaveBeenLastCalledWith('week_3', 'domingo', 0, true, false);
    expect(result.current.activeWeek.sundayMonday.tasks[0]).toMatchObject({ completed: true, reopened: false });
  });

  it('el reloj marca las pasadas pero NO las que están en proceso (alguien fichado en ellas)', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 11, 0));
    const { result } = montar();
    // la de las 15:00 del domingo también pasó (es lunes 11:00): la 1 se marca, la 0 está en proceso
    act(() => result.current.autoCompletePastTasks(new Set(['domingo:0'])));

    expect(patch).toHaveBeenCalledWith('week_3', 'domingo', 1, true, false);
    expect(patch).not.toHaveBeenCalledWith('week_3', 'domingo', 0, true, false);
  });
});

describe('useWeeks — crear semana con eventos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('la semana nueva lleva SUS eventos con pax y una clonada no hereda los de la anterior', () => {
    const { result } = montar();
    const anterior = { ...semana(), events: [{ name: 'Boda Vieja', pax: 200 }] };
    act(() => result.current.setAllWeeks({ week_3: anterior }));

    act(() => result.current.handleCreateWeek({
      name: 'Semana 4', dateRange: 'Del 22 al 27 de septiembre', cloneCurrent: true,
      events: [{ name: 'Boda Nueva', pax: 90 }],
    }));
    const creada = Object.values(result.current.allWeeks).find(w => w.name === 'Semana 4');
    expect(creada.events).toEqual([{ name: 'Boda Nueva', pax: 90 }]);

    act(() => result.current.handleCreateWeek({ name: 'Semana 5', dateRange: 'Del 29 de septiembre al 4 de octubre', cloneCurrent: true }));
    const sinEventos = Object.values(result.current.allWeeks).find(w => w.name === 'Semana 5');
    expect(sinEventos.events).toEqual([]);
  });
});
