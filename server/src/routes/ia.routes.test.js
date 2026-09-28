import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../models/AdminConfig.model.js', () => ({ AdminConfig: { findOne: vi.fn().mockResolvedValue(null) } }));
const rutas = (await import('./ia.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/ia', rutas); return a; };
const admin = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;
const cuerpo = { contents: [{ role: 'user', parts: [{ text: 'hola' }] }], generationConfig: { responseMimeType: 'application/json' } };

beforeEach(() => { process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real'; process.env.GEMINI_API_KEY = 'CLAVE-DEL-SERVIDOR'; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });

describe('POST /api/ia/gemini', () => {
  it('exige admin (ni socias ni nadie sin sesión gasta la clave)', async () => {
    expect((await request(app()).post('/api/ia/gemini').send(cuerpo)).status).toBe(401);
    const socias = `Bearer ${signToken({ role: 'socias', v: 1, sv: 1 })}`;
    expect((await request(app()).post('/api/ia/gemini').set('Authorization', socias).send(cuerpo)).status).toBe(401);
  });

  it('llama a Google con la clave del servidor en la cabecera y devuelve su respuesta tal cual', async () => {
    const google = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) });
    vi.stubGlobal('fetch', google);
    const r = await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send(cuerpo);
    expect(r.status).toBe(200);
    expect(r.body.candidates).toHaveLength(1);
    const [url, opciones] = google.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash');
    expect(url).not.toContain('CLAVE-DEL-SERVIDOR');
    expect(opciones.headers['x-goog-api-key']).toBe('CLAVE-DEL-SERVIDOR');
  });

  it('si el modelo ya no existe prueba el siguiente; sin clave en el servidor, 503', async () => {
    const google = vi.fn()
      .mockResolvedValueOnce({ status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: 1 }) });
    vi.stubGlobal('fetch', google);
    expect((await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send(cuerpo)).body).toEqual({ ok: 1 });
    expect(google.mock.calls[1][0]).toContain('gemini-flash-latest');
    delete process.env.GEMINI_API_KEY;
    expect((await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send(cuerpo)).status).toBe(503);
  });

  it('si Google dice que el modelo está saturado (503) prueba el siguiente; si todos lo están, devuelve su motivo', async () => {
    const saturado = { status: 503, json: async () => ({ error: { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' } }) };
    const google = vi.fn().mockResolvedValueOnce(saturado).mockResolvedValueOnce({ status: 200, json: async () => ({ ok: 2 }) });
    vi.stubGlobal('fetch', google);
    expect((await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send(cuerpo)).body).toEqual({ ok: 2 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(saturado));
    const r = await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send(cuerpo);
    expect(r.status).toBe(503);
    expect(r.body.error.status).toBe('UNAVAILABLE'); // no es "falta la clave": el cliente lo distingue
  });

  it('rechaza una petición sin contenido', async () => {
    expect((await request(app()).post('/api/ia/gemini').set('Authorization', admin()).send({})).status).toBe(400);
  });

  it('GET /estado dice si hay clave (solo admin)', async () => {
    expect((await request(app()).get('/api/ia/estado').set('Authorization', admin())).body).toEqual({ configurada: true });
    expect((await request(app()).get('/api/ia/estado')).status).toBe(401);
  });
});
