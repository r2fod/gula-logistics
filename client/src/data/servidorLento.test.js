import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AVISO_LENTO_MS, seguirPeticion, escucharServidorLento } from './servidorLento';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('servidorLento (Render dormido)', () => {
  it('avisa cuando una petición pasa del tiempo sin respuesta y deja de avisar al llegar', async () => {
    const estados = [];
    const dejar = escucharServidorLento((lento) => estados.push(lento));
    let responder;
    const peticion = seguirPeticion(new Promise((r) => { responder = r; }));
    await vi.advanceTimersByTimeAsync(AVISO_LENTO_MS - 1);
    expect(estados).toEqual([false]); // aún no
    await vi.advanceTimersByTimeAsync(1);
    expect(estados).toEqual([false, true]);
    responder('ok');
    expect(await peticion).toBe('ok'); // devuelve la respuesta tal cual
    expect(estados).toEqual([false, true, false]);
    dejar();
  });

  it('una petición rápida (o que falla rápido) no avisa, y el error sigue hacia quien llama', async () => {
    const estados = [];
    const dejar = escucharServidorLento((lento) => estados.push(lento));
    await expect(seguirPeticion(Promise.reject(new Error('sin red')))).rejects.toThrow('sin red');
    await seguirPeticion(Promise.resolve(1));
    await vi.advanceTimersByTimeAsync(AVISO_LENTO_MS * 2);
    expect(estados).toEqual([false]);
    dejar();
  });

  it('con dos lentas, sigue avisando hasta que llega la última', async () => {
    const estados = [];
    const dejar = escucharServidorLento((lento) => estados.push(lento));
    let a; let b;
    seguirPeticion(new Promise((r) => { a = r; }));
    seguirPeticion(new Promise((r) => { b = r; }));
    await vi.advanceTimersByTimeAsync(AVISO_LENTO_MS);
    a(); await vi.advanceTimersByTimeAsync(0);
    expect(estados.at(-1)).toBe(true);
    b(); await vi.advanceTimersByTimeAsync(0);
    expect(estados.at(-1)).toBe(false);
    dejar();
  });
});
