import { describe, it, expect, beforeEach, vi } from 'vitest';
import { patchTaskCompletionInAPI, retryPendingTaskPatches, conTareasPendientes, tareasPendientes } from './colaTareas';
import { fetchWeeksFromAPI } from './apiService';

const semana = () => ({
  week_1: {
    meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' },
    schedule: { jueves: { tasks: [{ id: 'j1', text: 'Boda Ana - Recogida', completed: false }, { id: 'j2', text: 'Otra' }] } },
    saturdaySpecial: { weddings: [{ location: 'Finca Sur' }] },
    sundayMonday: { tasks: [] },
  },
});
const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('cola de tareas marcadas sin cobertura', () => {
  it('BUG evitado: una tarea marcada sin red no se pierde; el sondeo no la desmarca y se sube al volver la red', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await patchTaskCompletionInAPI('week_1', 'jueves', 0, true, false, '2026-10-08T12:00:00.000Z')).toBeNull();
    expect(tareasPendientes()).toHaveLength(1);

    // El sondeo trae la semana del servidor, que aún no la tiene marcada: se ve marcada igual.
    global.fetch = vi.fn().mockResolvedValue(ok(semana()));
    const semanas = await fetchWeeksFromAPI();
    expect(semanas.week_1.schedule.jueves.tasks[0]).toMatchObject({ id: 'j1', completed: true, completedAt: '2026-10-08T12:00:00.000Z' });
    expect(semanas.week_1.schedule.jueves.tasks[1]).toEqual({ id: 'j2', text: 'Otra' }); // el resto, tal cual

    // Vuelve la red: se sube y sale de la cola.
    global.fetch = vi.fn().mockResolvedValue(ok());
    expect((await retryPendingTaskPatches()).map(c => c.taskIndex)).toEqual([0]);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ dayKey: 'jueves', taskIndex: 0, completed: true, reopened: false, completedAt: '2026-10-08T12:00:00.000Z' });
    expect(tareasPendientes()).toEqual([]);
  });

  it('con el servidor dormido o caído (5xx) también espera; un 404 (ya no existe) no se reintenta', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await patchTaskCompletionInAPI('week_1', 'sabado', 0, true, false, 'x');
    expect(tareasPendientes()).toHaveLength(1);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await retryPendingTaskPatches();
    expect(tareasPendientes()).toEqual([]);
    await patchTaskCompletionInAPI('week_1', 'jueves', 9, true, false, 'x');
    expect(tareasPendientes()).toEqual([]);
  });

  it('si se toca otra vez la misma tarea, vale la última; con red, no se encola nada', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    await patchTaskCompletionInAPI('week_1', 'jueves', 0, true, false, 'a');
    await patchTaskCompletionInAPI('week_1', 'jueves', 0, false, true, null);
    expect(tareasPendientes()).toEqual([{ weekId: 'week_1', dayKey: 'jueves', taskIndex: 0, completed: false, reopened: true, completedAt: null }]);
    global.fetch = vi.fn().mockResolvedValue(ok({ success: true }));
    await patchTaskCompletionInAPI('week_1', 'jueves', 0, true, false, 'b');
    expect(tareasPendientes()).toEqual([]); // guardada: sale también la anterior
  });

  it('sin pendientes, las semanas pasan tal cual (el mismo objeto)', () => {
    const s = semana();
    expect(conTareasPendientes(s)).toBe(s);
    expect(conTareasPendientes(null)).toBeNull();
  });
});
