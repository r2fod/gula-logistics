import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopiado } from './useCopiado';

let escribir;

beforeEach(() => {
  vi.useFakeTimers();
  escribir = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCopiado', () => {
  it('copia el texto, se marca como copiado y se desmarca a los 3 segundos', async () => {
    const { result } = renderHook(() => useCopiado());
    expect(result.current[0]).toBeNull();

    await act(async () => { await result.current[1]('hola'); });
    expect(escribir).toHaveBeenCalledWith('hola');
    expect(result.current[0]).toBe(true);

    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current[0]).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current[0]).toBeNull();
  });

  it('guarda la marca pedida, para saber cuál de una lista se copió', async () => {
    const { result } = renderHook(() => useCopiado());
    await act(async () => { await result.current[1]('a', 'Ana'); });
    expect(result.current[0]).toBe('Ana');
    await act(async () => { await result.current[1]('b', 'Luis'); });
    expect(result.current[0]).toBe('Luis');
  });

  it('un segundo copiado reinicia la cuenta atrás', async () => {
    const { result } = renderHook(() => useCopiado());
    await act(async () => { await result.current[1]('a'); });
    act(() => { vi.advanceTimersByTime(2000); });
    await act(async () => { await result.current[1]('b'); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current[0]).toBe(true);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current[0]).toBeNull();
  });

  it('si el navegador no deja copiar no lo marca como copiado', async () => {
    escribir.mockRejectedValue(new Error('denegado'));
    const { result } = renderHook(() => useCopiado());
    let ok;
    await act(async () => { ok = await result.current[1]('hola'); });
    expect(ok).toBe(false);
    expect(result.current[0]).toBeNull();
  });
});
