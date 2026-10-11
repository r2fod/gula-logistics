import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../models/ClockEntry.model.js', () => ({ ClockEntry: { find: vi.fn() } }));
const { ClockEntry } = await import('../models/ClockEntry.model.js');
const { mantenerDespierto, enDescanso, hayTurnoAbierto } = await import('./mantenerDespierto.js');

const DIEZ_MIN = 10 * 60 * 1000;
// 11/10/2026 es horario de verano (Madrid = UTC+2); 01/12/2026, de invierno (UTC+1).
const MEDIODIA = new Date('2026-10-11T10:00:00.000Z'); // 12:00 en Madrid
const MADRUGADA = new Date('2026-10-11T03:25:00.000Z'); // 05:25 en Madrid

describe('mantenerDespierto (el servidor se llama a sí mismo para que Render no lo duerma)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(MEDIODIA); });
  afterEach(() => { vi.useRealTimers(); delete process.env.MANTENER_DESPIERTO; delete process.env.DESCANSO_SERVIDOR; });

  it('llama a su propia dirección pública cada 10 min, antes de los 15 en que Render duerme', async () => {
    const pedir = vi.fn().mockResolvedValue({ ok: true });
    const reloj = mantenerDespierto({ url: 'https://ejemplo.test/', pedir, hayActividad: async () => false });
    expect(pedir).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DIEZ_MIN);
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir.mock.calls[0][0]).toBe('https://ejemplo.test/api/health');
    await vi.advanceTimersByTimeAsync(2 * DIEZ_MIN);
    expect(pedir).toHaveBeenCalledTimes(3);
    clearInterval(reloj);
  });

  it('un fallo de red no tumba el servidor: lo vuelve a intentar a los 10 min', async () => {
    const pedir = vi.fn().mockRejectedValue(new Error('sin red'));
    const reloj = mantenerDespierto({ url: 'https://ejemplo.test', pedir, hayActividad: async () => false });
    await vi.advanceTimersByTimeAsync(2 * DIEZ_MIN);
    expect(pedir).toHaveBeenCalledTimes(2);
    clearInterval(reloj);
  });

  it('fuera de Render (sin dirección pública) o con MANTENER_DESPIERTO=no, no hace nada', async () => {
    const pedir = vi.fn();
    expect(mantenerDespierto({ url: '', pedir })).toBeNull();
    process.env.MANTENER_DESPIERTO = 'no';
    expect(mantenerDespierto({ url: 'https://ejemplo.test', pedir })).toBeNull();
    await vi.advanceTimersByTimeAsync(3 * DIEZ_MIN);
    expect(pedir).not.toHaveBeenCalled();
  });

  it('de 5 a 7 de la mañana descansa: no se llama… salvo que haya alguien con el turno abierto', async () => {
    vi.setSystemTime(MADRUGADA);
    const pedir = vi.fn().mockResolvedValue({ ok: true });
    const sinNadie = mantenerDespierto({ url: 'https://ejemplo.test', pedir, hayActividad: async () => false });
    await vi.advanceTimersByTimeAsync(3 * DIEZ_MIN); // 05:35, 05:45, 05:55
    expect(pedir).not.toHaveBeenCalled();
    clearInterval(sinNadie);

    vi.setSystemTime(MADRUGADA);
    const conTurno = mantenerDespierto({ url: 'https://ejemplo.test', pedir, hayActividad: async () => true });
    await vi.advanceTimersByTimeAsync(3 * DIEZ_MIN);
    expect(pedir).toHaveBeenCalledTimes(3);
    clearInterval(conTurno);
  });

  it('pasadas las 7 vuelve a llamarse (si algo lo despertó)', async () => {
    vi.setSystemTime(new Date('2026-10-11T04:55:00.000Z')); // 06:55 en Madrid
    const pedir = vi.fn().mockResolvedValue({ ok: true });
    const reloj = mantenerDespierto({ url: 'https://ejemplo.test', pedir, hayActividad: async () => false });
    await vi.advanceTimersByTimeAsync(DIEZ_MIN); // 07:05
    expect(pedir).toHaveBeenCalledTimes(1);
    clearInterval(reloj);
  });
});

describe('enDescanso (hora de Madrid, con su cambio de hora)', () => {
  it('en verano y en invierno, de las 05:00 hasta antes de las 07:00', () => {
    expect(enDescanso(new Date('2026-10-11T03:00:00.000Z'), '5-7')).toBe(true);  // 05:00 (verano)
    expect(enDescanso(new Date('2026-10-11T04:59:00.000Z'), '5-7')).toBe(true);  // 06:59
    expect(enDescanso(new Date('2026-10-11T05:00:00.000Z'), '5-7')).toBe(false); // 07:00
    expect(enDescanso(new Date('2026-10-11T02:59:00.000Z'), '5-7')).toBe(false); // 04:59
    expect(enDescanso(new Date('2026-12-01T04:30:00.000Z'), '5-7')).toBe(true);  // 05:30 (invierno)
    expect(enDescanso(new Date('2026-12-01T03:30:00.000Z'), '5-7')).toBe(false); // 04:30
  });

  it('el tramo puede cruzar la medianoche; «no» o algo ilegible = sin descanso', () => {
    expect(enDescanso(new Date('2026-10-11T21:30:00.000Z'), '23-6')).toBe(true);  // 23:30
    expect(enDescanso(new Date('2026-10-11T02:00:00.000Z'), '23-6')).toBe(true);  // 04:00
    expect(enDescanso(new Date('2026-10-11T10:00:00.000Z'), '23-6')).toBe(false); // 12:00
    expect(enDescanso(MADRUGADA, 'no')).toBe(false);
    expect(enDescanso(MADRUGADA, '')).toBe(false);
    expect(enDescanso(MADRUGADA, '7-7')).toBe(false);
  });
});

describe('hayTurnoAbierto', () => {
  const fichajes = (lista) => ClockEntry.find.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => lista }) }) });
  beforeEach(() => { mongoose.connection.readyState = 1; ClockEntry.find.mockReset(); });
  afterEach(() => { mongoose.connection.readyState = 0; });

  it('sí, si el último fichaje de jornada de alguien es una entrada', async () => {
    // Del más reciente al más antiguo, como los pide.
    fichajes([{ workerName: 'Ana', type: 'salida' }, { workerName: 'Luis', type: 'entrada' }, { workerName: 'Ana', type: 'entrada' }]);
    expect(await hayTurnoAbierto(MADRUGADA)).toBe(true);
    const [consulta] = ClockEntry.find.mock.calls[0];
    expect(consulta.timestamp.$gte).toBe('2026-10-10T11:25:00.000Z'); // solo las últimas 16 h
    expect(consulta.type.$in).toEqual(['entrada', 'salida']);
  });

  it('no, si todos han fichado la salida, si no hay fichajes o si no hay base', async () => {
    fichajes([{ workerName: 'Ana', type: 'salida' }, { workerName: 'ana', type: 'entrada' }]);
    expect(await hayTurnoAbierto(MADRUGADA)).toBe(false);
    fichajes([]);
    expect(await hayTurnoAbierto(MADRUGADA)).toBe(false);
    mongoose.connection.readyState = 0;
    ClockEntry.find.mockClear();
    expect(await hayTurnoAbierto(MADRUGADA)).toBe(false);
    expect(ClockEntry.find).not.toHaveBeenCalled();
  });
});
