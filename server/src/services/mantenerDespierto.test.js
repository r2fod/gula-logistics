import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mantenerDespierto } from './mantenerDespierto.js';

describe('mantenerDespierto (el servidor se llama a sí mismo para que Render no lo duerma)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); delete process.env.MANTENER_DESPIERTO; });

  it('llama a su propia dirección pública cada 10 min, antes de los 15 en que Render duerme', async () => {
    const pedir = vi.fn().mockResolvedValue({ ok: true });
    const reloj = mantenerDespierto({ url: 'https://ejemplo.test/', pedir });
    expect(pedir).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir.mock.calls[0][0]).toBe('https://ejemplo.test/api/health');
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(pedir).toHaveBeenCalledTimes(3);
    clearInterval(reloj);
  });

  it('un fallo de red no tumba el servidor: lo vuelve a intentar a los 10 min', async () => {
    const pedir = vi.fn().mockRejectedValue(new Error('sin red'));
    const reloj = mantenerDespierto({ url: 'https://ejemplo.test', pedir });
    await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
    expect(pedir).toHaveBeenCalledTimes(2);
    clearInterval(reloj);
  });

  it('fuera de Render (sin dirección pública) o con MANTENER_DESPIERTO=no, no hace nada', async () => {
    const pedir = vi.fn();
    expect(mantenerDespierto({ url: '', pedir })).toBeNull();
    process.env.MANTENER_DESPIERTO = 'no';
    expect(mantenerDespierto({ url: 'https://ejemplo.test', pedir })).toBeNull();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(pedir).not.toHaveBeenCalled();
  });
});
