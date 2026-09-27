import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const guardar = vi.fn();
vi.mock('../models/AiMemory.js', () => {
  function AiMemory(doc) { Object.assign(this, doc, { _id: 'nuevo' }); this.save = guardar; }
  AiMemory.find = vi.fn();
  AiMemory.findOne = vi.fn();
  AiMemory.findByIdAndDelete = vi.fn();
  AiMemory.findByIdAndUpdate = vi.fn();
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

describe('reglas propuestas por el asistente', () => {
  const enviar = (body) => request(app()).post('/api/aimemory').set('Authorization', admin()).send(body);

  it('se guardan como propuesta (no entran en el prompt hasta aprobarlas); por defecto, activa', async () => {
    AiMemory.findOne.mockResolvedValue(null);
    expect((await enviar({ content: 'Regla nueva', estado: 'propuesta', origen: 'asistente' })).body).toMatchObject({ estado: 'propuesta', origen: 'asistente' });
    expect((await enviar({ content: 'Otra', estado: 'lo-que-sea' })).body).toMatchObject({ estado: 'activa', origen: 'manual' });
  });

  it('escribir a mano una regla que estaba propuesta la activa', async () => {
    const existente = { _id: 'x', content: 'Regla', estado: 'propuesta', save: vi.fn() };
    AiMemory.findOne.mockResolvedValue(existente);
    const r = await enviar({ content: 'Regla' });
    expect(r.status).toBe(200);
    expect(existente.estado).toBe('activa');
    expect(existente.save).toHaveBeenCalled();
  });

  it('PATCH aprueba (solo admin, solo a "activa", id válido)', async () => {
    const id = '0123456789abcdef01234567';
    AiMemory.findByIdAndUpdate.mockResolvedValue({ _id: id, estado: 'activa' });
    expect((await request(app()).patch(`/api/aimemory/${id}`).send({ estado: 'activa' })).status).toBe(401);
    expect((await request(app()).patch(`/api/aimemory/${id}`).set('Authorization', admin()).send({ estado: 'propuesta' })).status).toBe(400);
    expect((await request(app()).patch('/api/aimemory/malo').set('Authorization', admin()).send({ estado: 'activa' })).status).toBe(400);
    const r = await request(app()).patch(`/api/aimemory/${id}`).set('Authorization', admin()).send({ estado: 'activa' });
    expect(r.status).toBe(200);
    expect(AiMemory.findByIdAndUpdate).toHaveBeenCalledWith(id, { $set: { estado: 'activa' } }, { new: true });
  });
});

describe('DELETE /api/aimemory/:id', () => {
  it('un id mal formado da 400 (no un 500)', async () => {
    const r = await request(app()).delete('/api/aimemory/no-es-un-id').set('Authorization', admin());
    expect(r.status).toBe(400);
    expect(AiMemory.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
