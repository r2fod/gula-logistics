import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useBodyScrollLock } from './useBodyScrollLock';

afterEach(cleanup);

describe('useBodyScrollLock', () => {
  it('con una ventana abierta bloquea el scroll y para el fondo animado; al cerrar la última, todo vuelve', () => {
    const primera = renderHook(({ abierto }) => useBodyScrollLock(abierto), { initialProps: { abierto: true } });
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.classList.contains('modal-abierto')).toBe(true);

    // Una confirmación encima de otra ventana: al cerrarla, la de debajo sigue abierta.
    const segunda = renderHook(() => useBodyScrollLock(true));
    segunda.unmount();
    expect(document.body.classList.contains('modal-abierto')).toBe(true);

    primera.rerender({ abierto: false });
    expect(document.body.style.overflow).toBe('');
    expect(document.body.classList.contains('modal-abierto')).toBe(false);
  });
});
