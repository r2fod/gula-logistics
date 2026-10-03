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
import { deleteClockEntryInAPI, updateClockEntryInAPI } from '../data/apiService';

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
});
