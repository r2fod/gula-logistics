import { describe, it, expect, vi, afterEach } from 'vitest';
import { CADA_MS, urlDeLatido, mantenerDespierto } from './mantenerDespierto.js';

afterEach(() => vi.useRealTimers());

describe('mantener despierto el servidor (Render gratis)', () => {
  it('se llama por su dirección PÚBLICA de Render; fuera de Render o con MANTENER_DESPIERTO=no, no', () => {
    expect(urlDeLatido({ RENDER: 'true', RENDER_EXTERNAL_URL: 'https://app-de-prueba.onrender.com/' })).toBe('https://app-de-prueba.onrender.com/api/health');
    expect(urlDeLatido({ RENDER: 'true' })).toBe('https://gula-logistics.onrender.com/api/health');
    expect(urlDeLatido({})).toBeNull(); // en local y en los tests
    expect(urlDeLatido({ RENDER: 'true', MANTENER_DESPIERTO: 'no' })).toBeNull();
  });

  it('BUG evitado: Render se dormía (el keep-alive de GitHub iba cada 3–5 h); ahora el servidor se llama cada 10 min, antes de los 15', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    const llamar = vi.fn().mockResolvedValue({ ok: true });
    const reloj = mantenerDespierto({ env: { RENDER: 'true' }, llamar });
    expect(CADA_MS).toBeLessThan(15 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(CADA_MS * 3);
    expect(llamar).toHaveBeenCalledTimes(3);
    expect(llamar.mock.calls[0][0]).toBe('https://gula-logistics.onrender.com/api/health');
    clearInterval(reloj);
  });

  it('un fallo de red no rompe nada y sigue llamando', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    const llamar = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValue({ ok: true });
    const reloj = mantenerDespierto({ env: { RENDER: 'true' }, llamar });
    await vi.advanceTimersByTimeAsync(CADA_MS * 2);
    expect(llamar).toHaveBeenCalledTimes(2);
    clearInterval(reloj);
  });

  it('fuera de Render no arranca nada', () => {
    const llamar = vi.fn();
    expect(mantenerDespierto({ env: {}, llamar })).toBeNull();
  });
});
