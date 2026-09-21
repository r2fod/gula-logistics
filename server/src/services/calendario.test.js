import { describe, it, expect, vi } from 'vitest';
import { leerApuntes, normalizarApunte, calendarioConfigurado, CalendarioError } from './calendario.js';

const ENV = { CALENDARIO_PROJECT_ID: 'proyecto-x', CALENDARIO_API_KEY: 'CLAVE-DE-PRUEBA', CALENDARIO_CODIGO: 'abc123' };
const doc = (apuntes) => ({ ok: true, status: 200, json: async () => ({ fields: { apuntes: { stringValue: JSON.stringify(apuntes) } } }) });

describe('normalizarApunte', () => {
  it('deja solo los campos necesarios: NUNCA personal, importes ni notas', () => {
    const a = normalizarApunte({
      id: '1', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'Evento X', pax: 35, sitio: 'Sala Uno', hora: '08:30',
      personal: [{ nombre: 'FULANO', importe: 14 }], notas: 'llamar al 600000000', evento: 'x',
    });
    expect(a).toEqual({ id: '1', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'Evento X', pax: 35, sitio: 'Sala Uno', hora: '08:30' });
    expect(JSON.stringify(a)).not.toContain('FULANO');
    expect(JSON.stringify(a)).not.toContain('600000000');
  });

  it('descarta los tipos que no interesan y los apuntes con fecha inválida', () => {
    expect(normalizarApunte({ id: '1', fecha: '2026-09-22', tipo: 'tarea', titulo: 'Visita' })).toBeNull();
    expect(normalizarApunte({ id: '1', fecha: '2026-09-22', tipo: 'cerrado', titulo: 'Día completo' })).toBeNull();
    expect(normalizarApunte({ id: '1', fecha: '22/09/2026', tipo: 'boda', titulo: 'X' })).toBeNull();
    expect(normalizarApunte(null)).toBeNull();
  });

  it('un pax absurdo ("10015" del calendario) se ignora en vez de creerlo', () => {
    expect(normalizarApunte({ id: '1', fecha: '2026-09-10', tipo: 'corporativo', titulo: 'X', pax: 10015 }).pax).toBeUndefined();
    expect(normalizarApunte({ id: '1', fecha: '2026-09-10', tipo: 'boda', titulo: 'X', pax: 0 }).pax).toBeUndefined();
  });
});

describe('leerApuntes', () => {
  it('lee el documento, filtra por rango (incluidos los que lo cruzan) y ordena', async () => {
    const fetchFn = vi.fn().mockResolvedValue(doc([
      { id: 'a', fecha: '2026-09-25', tipo: 'boda', titulo: 'Boda B', pax: 60 },
      { id: 'b', fecha: '2026-09-09', hasta: '2026-10-19', tipo: 'recogida', titulo: 'Camión' }, // alquiler continuo que cruza la semana
      { id: 'c', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'Evento A', hora: '08:30' },
      { id: 'd', fecha: '2026-09-23', tipo: 'tarea', titulo: 'Visita técnica' },
      { id: 'e', fecha: '2026-10-05', tipo: 'boda', titulo: 'Fuera de rango' },
    ]));
    const r = await leerApuntes({ desde: '2026-09-22', hasta: '2026-09-28', env: ENV, fetchFn });
    expect(r.map(a => a.id)).toEqual(['b', 'c', 'a']);
    expect(fetchFn.mock.calls[0][0]).toContain('/calendario/abc123');
  });

  it('sin configurar devuelve 503 y no llama a la red', async () => {
    const fetchFn = vi.fn();
    await expect(leerApuntes({ desde: '2026-09-22', hasta: '2026-09-28', env: {}, fetchFn })).rejects.toMatchObject({ estado: 503 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(calendarioConfigurado({})).toBe(false);
    expect(calendarioConfigurado(ENV)).toBe(true);
  });

  it('valida las fechas pedidas', async () => {
    await expect(leerApuntes({ desde: 'ayer', hasta: '2026-09-28', env: ENV, fetchFn: vi.fn() })).rejects.toMatchObject({ estado: 400 });
    await expect(leerApuntes({ desde: '2026-09-28', hasta: '2026-09-22', env: ENV, fetchFn: vi.fn() })).rejects.toMatchObject({ estado: 400 });
  });

  it('BUG evitado: un fallo de red o de la nube NUNCA filtra la clave en el mensaje', async () => {
    const caido = vi.fn().mockRejectedValue(new Error('fetch failed https://x?key=CLAVE-DE-PRUEBA'));
    const err = await leerApuntes({ desde: '2026-09-22', hasta: '2026-09-28', env: ENV, fetchFn: caido }).catch(e => e);
    expect(err).toBeInstanceOf(CalendarioError);
    expect(err.message).not.toContain('CLAVE-DE-PRUEBA');

    const malo = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const err2 = await leerApuntes({ desde: '2026-09-22', hasta: '2026-09-28', env: ENV, fetchFn: malo }).catch(e => e);
    expect(err2.message).toContain('403');
    expect(err2.message).not.toContain('CLAVE-DE-PRUEBA');
  });

  it('un documento con formato inesperado da error claro', async () => {
    const raro = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ fields: { apuntes: { stringValue: 'no es json' } } }) });
    await expect(leerApuntes({ desde: '2026-09-22', hasta: '2026-09-28', env: ENV, fetchFn: raro })).rejects.toThrow(/formato/);
  });
});
