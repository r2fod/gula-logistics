import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const guardar = vi.fn();
vi.mock('../models/AiMemory.js', () => {
  function AiMemory(doc) { Object.assign(this, doc, { _id: 'nuevo' }); this.save = guardar; }
  AiMemory.find = vi.fn();
  AiMemory.findOne = vi.fn();
  AiMemory.findByIdAndDelete = vi.fn();
  return { AiMemory };
});
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { AiMemory } = await import('../models/AiMemory.js');
const rutas = (await import('./aiMemory.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/aimemory', rutas); return a; };
const admin = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  vi.clearAllMocks();
});

describe('POST /api/aimemory', () => {
  const enviar = (content, token = admin()) => request(app()).post('/api/aimemory').set('Authorization', token).send({ content });

  it('exige admin', async () => {
    expect((await request(app()).post('/api/aimemory').send({ content: 'x' })).status).toBe(401);
  });

  it('guarda una frase corta (recortada)', async () => {
    AiMemory.findOne.mockResolvedValue(null);
    const r = await enviar('  Las bodas dobles necesitan más tiempo  ');
    expect(r.status).toBe(201);
    expect(r.body.content).toBe('Las bodas dobles necesitan más tiempo');
    expect(guardar).toHaveBeenCalled();
  });

  it('BUG evitado: rechaza vacíos y textos enormes (cada recuerdo entra en todos los prompts)', async () => {
    for (const c of ['', '   ', 'x'.repeat(301), 42]) expect((await enviar(c)).status).toBe(400);
    expect(guardar).not.toHaveBeenCalled();
  });

  it('no duplica un recuerdo que ya existe', async () => {
    AiMemory.findOne.mockResolvedValue({ _id: 'viejo', content: 'Regla' });
    const r = await enviar('Regla');
    expect(r.status).toBe(200);
    expect(r.body._id).toBe('viejo');
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/aimemory/:id', () => {
  it('un id mal formado da 400 (no un 500)', async () => {
    const r = await request(app()).delete('/api/aimemory/no-es-un-id').set('Authorization', admin());
    expect(r.status).toBe(400);
    expect(AiMemory.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
