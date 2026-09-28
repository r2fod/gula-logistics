import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/TeamRoster.model.js', () => ({ TeamRoster: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }));
vi.mock('../models/AdminConfig.model.js', () => ({ AdminConfig: { findOne: vi.fn().mockResolvedValue(null) } }));

const { TeamRoster } = await import('../models/TeamRoster.model.js');
const rosterRoutes = (await import('./roster.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/roster', rosterRoutes); return a; };
const admin = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  vi.clearAllMocks();
  mongoose.connection.readyState = 1;
  TeamRoster.findOneAndUpdate.mockImplementation(async (_q, { workers }) => ({ workers }));
});

describe('PUT /api/roster', () => {
  it('sin sesión de admin no se puede cambiar el equipo', async () => {
    expect((await request(app()).put('/api/roster').send({ workers: [] })).status).toBe(401);
    expect(TeamRoster.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('guarda "solo si hace falta", la nota y la disponibilidad fija; descarta lo que no sabe usar', async () => {
    const res = await request(app()).put('/api/roster').set('Authorization', admin()).send({
      workers: [{
        name: 'Ana', role: 'Conductora', backup: 'sí', nota: `  cuando no está en cocina${' x'.repeat(100)}`,
        disponibilidad: [
          { dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' },
          { dia: 'lunes', tipo: 'no', desde: '09:00' },
          { dia: 'nunca', tipo: 'no' },
          { dia: 'martes', tipo: 'solo', desde: 'por la tarde', hasta: '' },
          { dia: 'jueves', tipo: 'vacaciones' },
        ],
      }],
    });
    expect(res.status).toBe(200);
    const [guardada] = TeamRoster.findOneAndUpdate.mock.calls[0][1].workers;
    expect(guardada.backup).toBe(false); // solo true de verdad
    expect(guardada.nota.startsWith('cuando no está en cocina')).toBe(true);
    expect(guardada.nota.length).toBe(120);
    expect(guardada.disponibilidad).toEqual([
      { dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' },
      { dia: 'lunes', tipo: 'no', desde: '', hasta: '' },
    ]);
  });

  it('sin lista de trabajadores, 400', async () => {
    expect((await request(app()).put('/api/roster').set('Authorization', admin()).send({})).status).toBe(400);
  });
});
