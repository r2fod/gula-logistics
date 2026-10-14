import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '../test/render';

vi.mock('../data/apiService', () => ({
  fetchRosterFromAPI: vi.fn(),
  saveRosterToAPI: vi.fn().mockResolvedValue(true),
  saveTarifasToAPI: vi.fn(),
}));
const { fetchRosterFromAPI, saveTarifasToAPI } = await import('../data/apiService');
const { useWorkers } = await import('./useWorkers');
const { tarifaDe, usarTarifasPorDefecto } = await import('../data/tarifasPorDefecto');

describe('useWorkers — las tarifas por defecto vienen de la base', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); usarTarifasPorDefecto({}); });

  it('al llegar el equipo del servidor, llegan sus tarifas por defecto (y quedan en el dispositivo para la próxima vez)', async () => {
    fetchRosterFromAPI.mockResolvedValue({ workers: [{ name: 'Ana', role: 'x' }], tarifas: { extra: 12, nomina: 16, transporte: 9 } });
    const { result } = renderHook(() => useWorkers());
    await waitFor(() => expect(result.current.workersList).toHaveLength(1));
    expect(result.current.tarifas).toEqual({ extra: 12, nomina: 16, transporte: 9 });
    expect(tarifaDe(result.current.workersList[0])).toBe(12);
    expect(JSON.parse(localStorage.getItem('gula_tarifas_v1'))).toEqual({ extra: 12, nomina: 16, transporte: 9 });
  });

  it('sin red usa las últimas guardadas en el dispositivo', () => {
    localStorage.setItem('gula_tarifas_v1', JSON.stringify({ extra: 13 }));
    fetchRosterFromAPI.mockResolvedValue(null);
    const { result } = renderHook(() => useWorkers());
    expect(result.current.tarifas.extra).toBe(13);
    expect(tarifaDe({})).toBe(13);
  });

  it('BUG evitado: sin tarifas ni en el servidor ni en el dispositivo no hay ninguna (antes, 10 y 14 en el código)', () => {
    fetchRosterFromAPI.mockResolvedValue(null);
    const { result } = renderHook(() => useWorkers());
    expect(result.current.tarifas).toEqual({ extra: null, nomina: null, transporte: null });
    expect(tarifaDe({})).toBe(0);
  });

  it('el admin guarda las tarifas: se guardan en el servidor y valen al momento; si el servidor no las acepta, no cambia nada', async () => {
    fetchRosterFromAPI.mockResolvedValue(null);
    const { result } = renderHook(() => useWorkers());
    saveTarifasToAPI.mockResolvedValueOnce(null);
    let ok;
    await act(async () => { ok = await result.current.handleGuardarTarifas({ extra: 99 }); });
    expect(ok).toBe(false);
    expect(tarifaDe({})).toBe(0);
    saveTarifasToAPI.mockResolvedValueOnce({ extra: 14, transporte: 8 });
    await act(async () => { ok = await result.current.handleGuardarTarifas({ extra: 14, transporte: 8 }); });
    expect(ok).toBe(true);
    expect(result.current.tarifas).toMatchObject({ extra: 14, transporte: 8 });
    expect(tarifaDe({})).toBe(14);
  });
});
