import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, screen, waitFor } from '../test/render';

vi.mock('../data/apiService', () => ({
  saveClockEntryToAPI: vi.fn(),
  updateClockEntryInAPI: vi.fn().mockResolvedValue(true),
  deleteClockEntryInAPI: vi.fn().mockResolvedValue(true),
  restoreClockEntryInAPI: vi.fn().mockResolvedValue(true),
  vaciarPapeleraEnAPI: vi.fn().mockResolvedValue({ ok: true, borrados: 2 }),
}));

import { useClockings } from './useClockings';
import { deleteClockEntryInAPI, updateClockEntryInAPI, saveClockEntryToAPI } from '../data/apiService';

const f = (id, extra = {}) => ({ id, workerName: 'Ana', type: 'entrada', timestamp: '2026-09-20T08:00:00.000Z', ...extra });
const montar = (fichajes) => {
  localStorage.setItem('gula_clock_entries_v1', JSON.stringify(fichajes));
  return renderHook(() => useClockings());
};

describe('useClockings', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('BUG evitado: borrar varios seguidos los deja todos en la papelera (antes solo quedaba el último)', async () => {
    const { result } = montar([f('a'), f('b'), f('c')]);
    const { handleDeleteClockEntry } = result.current; // los dos con los fichajes del mismo render
    await act(async () => { await Promise.all([handleDeleteClockEntry('a'), handleDeleteClockEntry('b')]); });
    expect(result.current.deletedClockEntries.map(e => e.id)).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem('gula_clock_entries_v1')).filter(e => e.deleted)).toHaveLength(2);
  });

  it('mueve varios a la papelera de una vez (la revisión de fichajes)', async () => {
    const { result } = montar([f('a'), f('b'), f('c')]);
    await act(async () => { await result.current.handleDeleteClockEntries(['a', 'c']); });
    expect(deleteClockEntryInAPI).toHaveBeenCalledTimes(2);
    expect(result.current.activeClockEntries.map(e => e.id)).toEqual(['b']);
  });

  it('vaciar la papelera quita lo borrado y dice cuántos se han borrado para siempre', async () => {
    const { result } = montar([f('a', { deleted: true }), f('b', { deleted: true }), f('c')]);
    act(() => { result.current.handleVaciarPapelera(); });
    await waitFor(() => expect(result.current.clockEntries.map(e => e.id)).toEqual(['c']));
    expect(await screen.findByText('Papelera vaciada: 2 fichajes borrados para siempre.')).toBeTruthy();
  });

  it('«Está bien» en un turno largo marca su entrada como revisada en el servidor', async () => {
    const { result } = montar([f('a')]);
    await act(async () => { await result.current.handleMarcarRevisado(result.current.clockEntries[0]); });
    expect(updateClockEntryInAPI).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', revisado: true }));
    expect(result.current.clockEntries[0].revisado).toBe(true);
  });

  it('si el servidor exige el enlace personal y este móvil no lo tiene, el fichaje se quita y se avisa', async () => {
    saveClockEntryToAPI.mockResolvedValueOnce({ rechazado: 'Para fichar usa tu enlace personal: pídeselo al administrador.' });
    const { result } = montar([]);
    act(() => { result.current.handleClockEntryCreated(f('nuevo')); });
    expect(await screen.findByText(/No se ha fichado\. Para fichar usa tu enlace personal/)).toBeTruthy();
    expect(result.current.clockEntries).toEqual([]);
  });

  it('BUG evitado: editar un fichaje no le quita lo que la ventana de edición no toca (taskRef, firmado, revisado)', async () => {
    const taskRef = { day: 'tuesday', index: 0, weekId: 'week_1', taskId: 'm1', taskText: 'Boda A - Carga' };
    const { result } = montar([f('a', { taskRef, firmado: true, revisado: true })]);
    // Lo que manda AdminClockEditModal: el fichaje rehecho con crearFichaje, sin esos campos.
    const editado = { id: 'a', workerName: 'Ana', type: 'entrada', timestamp: '2026-09-20T09:00:00.000Z', editedByAdmin: true };
    await act(async () => { await result.current.handleUpdateClockEntry(editado); });
    expect(result.current.clockEntries[0]).toMatchObject({ timestamp: '2026-09-20T09:00:00.000Z', editedByAdmin: true, taskRef, firmado: true, revisado: true });
  });
});

