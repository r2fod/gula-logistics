import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { usarCuerposJson, erroresDeCuerpo } from './cuerpoJson.js';

function crearApp() {
  const app = express();
  usarCuerposJson(app);
  const eco = (req, res) => res.json({ bytes: JSON.stringify(req.body).length });
  app.post('/api/clock', eco);
  app.post('/api/notifications/subscribe', eco);
  app.post('/api/logistics/weeks', eco);
  app.use(erroresDeCuerpo);
  return app;
}
const relleno = (kb) => ({ note: 'x'.repeat(kb * 1024) });

describe('cuerpos JSON', () => {
  it('BUG evitado: un fichaje público de 20 KB ya no entra (antes, hasta 2 MB) y el motivo llega en JSON', async () => {
    const res = await request(crearApp()).post('/api/clock').send(relleno(20));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/demasiado grandes/);
    expect((await request(crearApp()).post('/api/notifications/subscribe').send(relleno(20))).status).toBe(413);
  });

  it('un fichaje normal y una semana grande (admin) siguen entrando', async () => {
    expect((await request(crearApp()).post('/api/clock').send({ workerName: 'Ana', type: 'entrada', note: 'x'.repeat(500) })).status).toBe(200);
    expect((await request(crearApp()).post('/api/logistics/weeks').send(relleno(500))).status).toBe(200);
  });

  it('un JSON roto responde 400 en JSON, no con la página HTML de Express', async () => {
    const res = await request(crearApp()).post('/api/clock').set('Content-Type', 'application/json').send('{roto');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });
});
