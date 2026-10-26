import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { esperarBaseDeDatos } from './esperarBaseDeDatos.js';

function buildApp() {
  const app = express();
  app.use(esperarBaseDeDatos({ esperaMs: 50 }));
  app.post('/fichar', (req, res) => res.status(201).json({ ok: true }));
  return app;
}

const uriAntes = process.env.MONGODB_URI;
afterEach(() => {
  if (uriAntes === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = uriAntes;
});

describe('esperarBaseDeDatos', () => {
  beforeEach(() => { process.env.MONGODB_URI = 'mongodb://de-test-no-real'; });

  it('BUG evitado: con base configurada pero sin conectar, responde 503 en vez de guardar en memoria y decir 201', async () => {
    mongoose.connection.readyState = 0;
    const res = await request(buildApp()).post('/fichar');
    expect(res.status).toBe(503);
  });

  it('con la base conectada pasa a la ruta', async () => {
    mongoose.connection.readyState = 1;
    expect((await request(buildApp()).post('/fichar')).status).toBe(201);
  });

  it('si conecta mientras espera, sigue a la ruta', async () => {
    mongoose.connection.readyState = 0;
    const app = express();
    app.use(esperarBaseDeDatos({ esperaMs: 1000 }));
    app.post('/fichar', (req, res) => res.status(201).json({ ok: true }));
    setTimeout(() => { mongoose.connection.readyState = 1; mongoose.connection.emit('connected'); }, 20);
    expect((await request(app).post('/fichar')).status).toBe(201);
  });

  it('sin MONGODB_URI (desarrollo) no espera: sigue el respaldo en memoria', async () => {
    delete process.env.MONGODB_URI;
    mongoose.connection.readyState = 0;
    expect((await request(buildApp()).post('/fichar')).status).toBe(201);
  });
});
