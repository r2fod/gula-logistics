import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp, useEntrada, movimientoReducido } from './useAnimaciones';

const conMovimiento = (reducir) => vi.stubGlobal('matchMedia', (q) => ({ matches: reducir && q.includes('reduce'), media: q }));

describe('useAnimaciones', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }));
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('sin matchMedia (tests, navegadores viejos) no hay animación: valor final al instante', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(movimientoReducido()).toBe(true);
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe(42);
  });

  it('con "reducir movimiento" activado el número no corre', () => {
    conMovimiento(true);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 10 } });
    expect(result.current).toBe(10);
    rerender({ v: 99 });
    expect(result.current).toBe(99);
  });

  it('el número sube desde 0 hasta su valor y termina EXACTO', () => {
    conMovimiento(false);
    const { result } = renderHook(() => useCountUp(100, 700));
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(350); });
    expect(result.current).toBeGreaterThan(50); // ease-out: a mitad de tiempo ya va por delante
    expect(result.current).toBeLessThan(100);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).toBe(100);
  });

  it('si el valor cambia a mitad de camino sigue desde donde estaba, sin volver a 0', () => {
    conMovimiento(false);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 700), { initialProps: { v: 100 } });
    act(() => { vi.advanceTimersByTime(800); }); // los fotogramas simulados van cada ~16 ms
    expect(result.current).toBe(100);
    rerender({ v: 200 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(200);
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current).toBe(200);
  });

  it('un valor no numérico se trata como 0', () => {
    conMovimiento(true);
    expect(renderHook(() => useCountUp(NaN)).result.current).toBe(0);
  });

  it('useEntrada: false en el primer pintado y true en el siguiente; con movimiento reducido, true ya', () => {
    conMovimiento(false);
    const { result } = renderHook(() => useEntrada());
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(true);

    conMovimiento(true);
    expect(renderHook(() => useEntrada()).result.current).toBe(true);
  });
});
