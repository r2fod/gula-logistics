import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '../test/render';
import { useAhora } from './useAhora';

describe('useAhora: reloj compartido', () => {
  afterEach(() => vi.useRealTimers());

  it('varios usos del mismo intervalo comparten UN solo setInterval y marcan la misma hora', () => {
    vi.useFakeTimers();
    const espia = vi.spyOn(globalThis, 'setInterval');
    const a = renderHook(() => useAhora(1000));
    const b = renderHook(() => useAhora(1000));
    expect(espia.mock.calls.filter(([, ms]) => ms === 1000)).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(a.result.current).toBe(b.result.current);
    a.unmount();
    b.unmount();
    espia.mockRestore();
  });

  it('al desmontar a todos se para el intervalo', () => {
    vi.useFakeTimers();
    const limpiar = vi.spyOn(globalThis, 'clearInterval');
    const a = renderHook(() => useAhora(2500));
    a.unmount();
    expect(limpiar).toHaveBeenCalled();
    limpiar.mockRestore();
  });

  it('la hora avanza con cada tic', () => {
    vi.useFakeTimers();
    const a = renderHook(() => useAhora(1000));
    const antes = a.result.current;
    act(() => { vi.advanceTimersByTime(3000); });
    expect(a.result.current.getTime()).toBeGreaterThan(antes.getTime());
    a.unmount();
  });
});
