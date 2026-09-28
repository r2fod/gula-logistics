import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '../test/render';

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

describe('useWeeks — marcar y desmarcar tareas (solo a mano)', () => {
  beforeEach(() => { vi.useFakeTimers(); patch.mockReset(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('pulsar una tarea pendiente la marca con la hora real; pulsarla otra vez la desmarca', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 11, 0)); // ya pasó su hora: aun así sigue pendiente hasta que alguien la pulse
    const { result } = montar();
    expect(result.current.activeWeek.sundayMonday.tasks[0].completed).toBe(false);

    act(() => result.current.toggleTask('domingo', 0));
    const hora = new Date(2026, 8, 21, 11, 0).toISOString();
    expect(patch).toHaveBeenLastCalledWith('week_3', 'domingo', 0, true, false, hora);
    expect(result.current.activeWeek.sundayMonday.tasks[0]).toMatchObject({ completed: true, reopened: false, completedAt: hora });

    act(() => result.current.toggleTask('domingo', 0));
    expect(patch).toHaveBeenLastCalledWith('week_3', 'domingo', 0, false, true, null);
    expect(result.current.activeWeek.sundayMonday.tasks[0]).toMatchObject({ completed: false, completedAt: null });
  });

  it('la salida de un fichaje de la tarea la marca (con hora) y no la vuelve a escribir si ya estaba hecha', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 10, 5));
    const { result } = montar();
    act(() => result.current.markTaskCompleted('domingo', 0));
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('week_3', 'domingo', 0, true, false, new Date(2026, 8, 21, 10, 5).toISOString());

    act(() => result.current.markTaskCompleted('domingo', 0));
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it('BUG evitado: el hook ya no ofrece nada que marque tareas solas por la hora', () => {
    const { result } = montar();
    expect(result.current.autoCompletePastTasks).toBeUndefined();
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

describe('useWeeks — semana con la que se abre', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const conSemanas = (semanas) => vi.stubGlobal('localStorage', { store: { gula_logistics_all_weeks_v10: JSON.stringify(semanas) }, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } });
  const w = (id, dateRange) => ({ ...semana(), id, name: id, meta: { dateRange, status: 'Operativa Activa' } });

  it('abre la semana de hoy, no siempre la 3', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0)); // jueves de la semana 4
    conSemanas({ week_3: w('week_3', 'Del 15 al 20 de Septiembre de 2026'), week_4: w('week_4', 'Del 22 al 27 de Septiembre de 2026') });
    expect(renderHook(() => useWeeks()).result.current.activeWeekId).toBe('week_4');
  });

  it('BUG evitado: el lunes por la noche, con la semana 3 terminada, abre la 4 en el primer pintado', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 21, 20, 30));
    conSemanas({ week_3: { ...w('week_3', 'Del 15 al 20 de Septiembre de 2026'), sundayMonday: { tasks: [{ text: 'x', timeFrame: '09:30 - 10:00', targetDay: 'Lunes', completed: true, assigned: ['Ana'] }] } }, week_4: w('week_4', 'Del 22 al 27 de Septiembre de 2026') });
    expect(renderHook(() => useWeeks()).result.current.activeWeekId).toBe('week_4');
  });

  it('sin semanas legibles abre la primera que existe (no la de ejemplo del código)', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
    conSemanas({ x: w('x', 'fechas raras') });
    expect(renderHook(() => useWeeks()).result.current.activeWeekId).toBe('x');
  });
});

describe('useWeeks — semana activa siempre válida', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const conSemanas = (semanas) => vi.stubGlobal('localStorage', { store: { gula_logistics_all_weeks_v10: JSON.stringify(semanas) }, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; } });

  it('BUG evitado: un id que no existe (p. ej. el texto de una opción) no abre la semana de ejemplo, abre una real', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 17, 10, 0));
    const real = { ...semana(), name: 'Semana 3', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' } }; // sin campo `id`, como la de producción
    delete real.id;
    conSemanas({ week_3: real });
    const { result } = renderHook(() => useWeeks());
    act(() => result.current.setActiveWeekId('Semana 3 (Del 15 al 20 de Septiembre de 2026)'));
    expect(result.current.activeWeekId).toBe('week_3');
    expect(result.current.activeWeek.name).toBe('Semana 3');
    expect(result.current.activeWeek.meta.week).not.toBe('Semana de ejemplo');
  });

  it('elegir otra semana que sí existe sigue funcionando', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 17, 10, 0));
    conSemanas({ week_3: { ...semana(), name: 'Semana 3' }, week_4: { ...semana(), id: 'week_4', name: 'Semana 4', meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' } } });
    const { result } = renderHook(() => useWeeks());
    act(() => result.current.setActiveWeekId('week_4'));
    expect(result.current.activeWeekId).toBe('week_4');
  });
});

describe('useWeeks — deshacer lo último que aplicó Gemini', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('guarda la versión anterior y, al deshacer, la restaura con el updatedAt actual (sin conflicto)', async () => {
    const { saveWeeksToAPI } = await import('../data/apiService');
    const { result } = montar();
    const antes = result.current.activeWeek;
    saveWeeksToAPI.mockResolvedValueOnce({ success: true, data: { week_3: { ...antes, schedule: { martes: { tasks: [{ text: 'De Gemini' }] } }, updatedAt: 'v2' } } });
    await act(async () => { await result.current.handleApplyGeminiSchedule({ schedule: { martes: { tasks: [{ text: 'De Gemini' }] } } }); });
    expect(result.current.deshacerIa).toMatchObject({ weekId: 'week_3', nombre: 'Semana 3' });
    expect(result.current.activeWeek.schedule.martes.tasks[0].text).toBe('De Gemini');
    expect(result.current.cambiadaTrasIa()).toBe(false);

    saveWeeksToAPI.mockResolvedValueOnce({ success: true, data: {} });
    await act(async () => { await result.current.deshacerUltimaIa(); });
    const enviado = saveWeeksToAPI.mock.calls.at(-1)[0].week_3;
    expect(enviado.schedule).toEqual(antes.schedule); // como antes de Gemini
    expect(enviado.updatedAt).toBe('v2'); // con la versión actual: el servidor no lo toma por conflicto
    expect(result.current.deshacerIa).toBeNull();
  });

  it('si el guardado falla no se ofrece deshacer', async () => {
    const { saveWeeksToAPI } = await import('../data/apiService');
    const { result } = montar();
    saveWeeksToAPI.mockResolvedValueOnce(null);
    // Con el guardado fallido la app se queda esperando a que se cierre su aviso de
    // error: no se espera a eso, solo a que termine el intento de guardar.
    await act(async () => { result.current.handleApplyGeminiSchedule({ schedule: {} }); await Promise.resolve(); await Promise.resolve(); });
    expect(saveWeeksToAPI).toHaveBeenCalled();
    expect(result.current.deshacerIa).toBeNull();
  });
});

describe('useWeeks — guardar solo lo que cambia', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('BUG evitado: al guardar una semana solo se envía esa (antes iban todas y, con muchas, el servidor lo rechazaba)', async () => {
    const { saveWeeksToAPI } = await import('../data/apiService');
    const { result } = montar();
    act(() => result.current.setAllWeeks({ week_3: semana(), week_4: { ...semana(), id: 'week_4', name: 'Semana 4' } }));
    saveWeeksToAPI.mockClear();
    saveWeeksToAPI.mockResolvedValueOnce({ success: true, data: {} });
    await act(async () => { await result.current.handleUpdateActiveWeek({ ...result.current.activeWeek, name: 'Semana 3 editada' }); });
    const enviado = saveWeeksToAPI.mock.calls[0][0];
    expect(Object.keys(enviado)).toEqual([result.current.activeWeekId]);
  });
});
