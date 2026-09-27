import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveClockEntryToAPI,
  retryPendingClockEntries,
  fetchClockEntriesFromAPI,
  getPendingClockEntriesSnapshot,
  saveWeeksToAPI,
  setStoredSociasToken,
  getStoredSociasToken,
  setStoredAdminToken,
  cerrarAccesosGuardados,
  fetchBalancesFromAPI,
  comprobarSesionEnAPI,
} from './apiService';

// Fichaje mínimo de prueba: entra si el worker/type/timestamp bastan para
// el propósito del test, sin todos los campos reales de ClockEntry.
function entry(overrides) {
  return { id: 'e1', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z', ...overrides };
}

// El entorno jsdom de este proyecto no expone un localStorage real (queda
// como un objeto vacío sin .clear/.getItem/.setItem) — se sustituye por un
// stub mínimo en memoria en vez de intentar arreglar esa infraestructura
// de test como parte de este cambio.
function createLocalStorageMock() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
  vi.restoreAllMocks();
});

describe('saveClockEntryToAPI', () => {
  it('si el servidor responde OK, no encola nada y devuelve el documento guardado', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => entry({ _id: 'mongo1' }) });
    const result = await saveClockEntryToAPI(entry());
    expect(result).toMatchObject({ _id: 'mongo1' });
    expect(getPendingClockEntriesSnapshot()).toEqual([]);
  });

  it('si el fetch falla (sin cobertura), encola el fichaje en vez de perderlo y devuelve null', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await saveClockEntryToAPI(entry({ id: 'e2' }));
    expect(result).toBeNull();
    expect(getPendingClockEntriesSnapshot()).toEqual([entry({ id: 'e2' })]);
  });

  it('si el servidor responde con error (500), también lo encola', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await saveClockEntryToAPI(entry({ id: 'e3' }));
    expect(result).toBeNull();
    expect(getPendingClockEntriesSnapshot().map(e => e.id)).toEqual(['e3']);
  });

  it('no encola el mismo fichaje dos veces si falla repetidamente', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await saveClockEntryToAPI(entry({ id: 'e4' }));
    await saveClockEntryToAPI(entry({ id: 'e4' }));
    expect(getPendingClockEntriesSnapshot()).toHaveLength(1);
  });
});

describe('retryPendingClockEntries', () => {
  it('reintenta cada fichaje pendiente; los que se guardan salen de la cola', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await saveClockEntryToAPI(entry({ id: 'e5' }));
    expect(getPendingClockEntriesSnapshot()).toHaveLength(1);

    // Ahora sí hay cobertura: el servidor (idempotente por id, ver
    // clock.routes.js) confirma el guardado.
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => entry({ id: 'e5' }) });
    const synced = await retryPendingClockEntries();

    expect(synced.map(e => e.id)).toEqual(['e5']);
    expect(getPendingClockEntriesSnapshot()).toEqual([]);
  });

  it('los que siguen fallando se quedan en la cola (no se pierden)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await saveClockEntryToAPI(entry({ id: 'e6' }));

    const synced = await retryPendingClockEntries();

    expect(synced).toEqual([]);
    expect(getPendingClockEntriesSnapshot().map(e => e.id)).toEqual(['e6']);
  });

  it('con la cola vacía, no hace ninguna petición', async () => {
    global.fetch = vi.fn();
    const synced = await retryPendingClockEntries();
    expect(synced).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchClockEntriesFromAPI (fusión con pendientes)', () => {
  it('no pierde un fichaje pendiente aunque el servidor todavía no lo tenga', async () => {
    // Un fichaje quedó pendiente (sin cobertura al crearlo).
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await saveClockEntryToAPI(entry({ id: 'e7', workerName: 'Bruno' }));

    // Vuelve la cobertura: el GET normal del polling trae la lista de Mongo,
    // que todavía NO incluye e7 (el POST de sincronización no ha llegado).
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [entry({ id: 'otroFichaje', workerName: 'Diego' })],
    });
    const result = await fetchClockEntriesFromAPI();

    const ids = result.map(e => e.id);
    expect(ids).toContain('e7'); // <- antes de este fix, desaparecía aquí
    expect(ids).toContain('otroFichaje');
  });

  it('una vez que el servidor SÍ tiene el fichaje, no lo duplica desde la cola de pendientes', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await saveClockEntryToAPI(entry({ id: 'e8' }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [entry({ id: 'e8' })], // ya sincronizado en el servidor
    });
    const result = await fetchClockEntriesFromAPI();

    expect(result.filter(e => e.id === 'e8')).toHaveLength(1);
  });
});

describe('saveWeeksToAPI (control de concurrencia)', () => {
  it('en éxito, devuelve el cuerpo normal de la respuesta', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { week_3: {} } }) });
    const result = await saveWeeksToAPI({ week_3: {} });
    expect(result).toEqual({ success: true, data: { week_3: {} } });
  });

  it('en 409 (guardado concurrente), devuelve { conflict: true, ... } en vez de null — para que quien llama no lo trate como un fallo cualquiera', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, conflict: true, message: 'Alguien más lo guardó', data: { week_3: { updatedAt: 'nuevo' } } }),
    });
    const result = await saveWeeksToAPI({ week_3: { updatedAt: 'viejo' } });
    expect(result).toEqual({ conflict: true, message: 'Alguien más lo guardó', data: { week_3: { updatedAt: 'nuevo' } } });
  });

  it('en otro error (500, red caída), sigue devolviendo null como siempre', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await saveWeeksToAPI({ week_3: {} });
    expect(result).toBeNull();
  });
});

describe('enlace de socias (solo lectura)', () => {
  // Token con la misma forma que los del servidor: cuerpo base64url + firma.
  const tokenCon = (cuerpo) => `${btoa(JSON.stringify(cuerpo)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.firma`;

  it('se guarda con la caducidad que lleva dentro y deja de valer al pasar', () => {
    const t = tokenCon({ role: 'socias', exp: Date.now() + 60000 });
    setStoredSociasToken(t);
    expect(getStoredSociasToken()).toBe(t);
    setStoredSociasToken(tokenCon({ role: 'socias', exp: Date.now() - 1 }));
    expect(getStoredSociasToken()).toBeNull();
  });

  it('las lecturas llevan el enlace de socias si no hay sesión de admin (y la de admin si la hay)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rol: 'socias' }) });
    const t = tokenCon({ role: 'socias', exp: Date.now() + 60000 });
    setStoredSociasToken(t);
    expect(await comprobarSesionEnAPI()).toBe('socias');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${t}`);
    setStoredAdminToken('ADMIN', Date.now() + 60000);
    await comprobarSesionEnAPI();
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer ADMIN');
  });

  it('comprobarSesionEnAPI: 401 = no vale (null); sin red = no se sabe (undefined, no se cierra nada)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(await comprobarSesionEnAPI()).toBeNull();
    global.fetch = vi.fn().mockRejectedValue(new Error('sin red'));
    expect(await comprobarSesionEnAPI()).toBeUndefined();
  });

  it('BUG evitado: sin acceso (401) NO enseña los saldos guardados de otra vez en este navegador', async () => {
    localStorage.setItem('gula_balances_data_v1', JSON.stringify({ workers: [{ id: 'ana', name: 'Ana', breakdown: [{ concept: 'x', amount: 1 }], currentBalance: 1 }] }));
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const datos = await fetchBalancesFromAPI();
    expect(JSON.stringify(datos)).not.toContain('Ana');
    expect(localStorage.getItem('gula_balances_data_v1')).toBeNull();
  });

  it('cerrar accesos borra sesión de admin, enlace de socias y copia de saldos', () => {
    setStoredAdminToken('ADMIN', Date.now() + 60000);
    setStoredSociasToken(tokenCon({ role: 'socias', exp: Date.now() + 60000 }));
    localStorage.setItem('gula_balances_data_v1', '{}');
    cerrarAccesosGuardados();
    expect(localStorage.getItem('gula_admin_token_v1')).toBeNull();
    expect(getStoredSociasToken()).toBeNull();
    expect(localStorage.getItem('gula_balances_data_v1')).toBeNull();
  });
});
