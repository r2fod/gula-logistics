import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const calendarioRoutes = (await import('./calendario.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

const buildApp = () => { const app = express(); app.use(express.json()); app.use('/api/calendario', calendarioRoutes); return app; };
const admin = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  delete process.env.CALENDARIO_PROJECT_ID; delete process.env.CALENDARIO_API_KEY; delete process.env.CALENDARIO_CODIGO;
});

describe('/api/calendario', () => {
  it('sin token de admin responde 401: el calendario tiene datos de clientes', async () => {
    expect((await request(buildApp()).get('/api/calendario/eventos?desde=2026-09-22&hasta=2026-09-28')).status).toBe(401);
    expect((await request(buildApp()).get('/api/calendario/estado')).status).toBe(401);
  });

  it('sin configurar: /estado dice false y /eventos 503 con configurado:false', async () => {
    const app = buildApp();
    const estado = await request(app).get('/api/calendario/estado').set('Authorization', admin());
    expect(estado.body).toEqual({ configurado: false });
    const r = await request(app).get('/api/calendario/eventos?desde=2026-09-22&hasta=2026-09-28').set('Authorization', admin());
    expect(r.status).toBe(503);
    expect(r.body.configurado).toBe(false);
  });

  it('fechas mal formadas: 400', async () => {
    process.env.CALENDARIO_PROJECT_ID = 'p'; process.env.CALENDARIO_API_KEY = 'k'; process.env.CALENDARIO_CODIGO = 'c';
    const r = await request(buildApp()).get('/api/calendario/eventos?desde=hoy&hasta=mañana').set('Authorization', admin());
    expect(r.status).toBe(400);
  });
});
