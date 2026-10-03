import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { limitePorIp } from './limitePorIp.js';

describe('limitePorIp', () => {
  it('deja pasar hasta el máximo y luego responde 429 con Retry-After', async () => {
    const app = express();
    app.post('/x', limitePorIp({ max: 2, ventanaMs: 60000 }), (req, res) => res.json({ ok: true }));
    expect((await request(app).post('/x')).status).toBe(200);
    expect((await request(app).post('/x')).status).toBe(200);
    const tercera = await request(app).post('/x');
    expect(tercera.status).toBe(429);
    expect(Number(tercera.headers['retry-after'])).toBeGreaterThan(0);
  });
});
