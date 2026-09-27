import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn() },
}));

const { AdminConfig } = await import('../models/AdminConfig.model.js');
const { requireAdmin, requireLectura } = await import('./requireAdmin.js');
const { signToken } = await import('../utils/authToken.js');

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  AdminConfig.findOne.mockReset();
  // Por defecto simulamos "sin conexión a Mongo" para aislar los tests que no
  // quieren tocar la parte de revocación por cambio de contraseña.
  mongoose.connection.readyState = 0;
});

describe('requireAdmin', () => {
  it('rechaza sin cabecera Authorization', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza una cabecera que no empieza por "Bearer "', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza un token con role distinto de "admin"', async () => {
    const token = signToken({ role: 'worker' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar un token admin válido cuando Mongo no está conectado (no puede comprobar revocación)', async () => {
    const token = signToken({ role: 'admin', v: 1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.admin).toMatchObject({ role: 'admin', v: 1 });
    expect(AdminConfig.findOne).not.toHaveBeenCalled();
  });

  it('deja pasar un token admin cuya versión coincide con la de AdminConfig', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 3 });
    const token = signToken({ role: 'admin', v: 3 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('revoca un token cuya versión ya no coincide (p.ej. tras cambiar la contraseña de admin)', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 4 }); // la contraseña cambió, ahora v=4
    const token = signToken({ role: 'admin', v: 3 }); // token emitido antes del cambio
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('falla cerrado (503) si la comprobación de revocación en Mongo da error, en vez de dejar pasar', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockRejectedValue(new Error('timeout de conexión'));
    const token = signToken({ role: 'admin', v: 1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('enlace de socias (solo lectura)', () => {
  const pasar = async (guardia, payload) => {
    const req = { headers: { authorization: `Bearer ${signToken(payload)}` } };
    const res = mockRes();
    const next = vi.fn();
    await guardia(req, res, next);
    return { res, next, req };
  };

  it('BUG evitado: un token de socias NO abre nada de administrador', async () => {
    const { res, next } = await pasar(requireAdmin, { role: 'socias', v: 1, sv: 1 });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireLectura acepta socias y admin, y deja el rol en la petición', async () => {
    const socias = await pasar(requireLectura, { role: 'socias', v: 1, sv: 1 });
    expect(socias.next).toHaveBeenCalled();
    expect(socias.req.rol).toBe('socias');
    expect((await pasar(requireLectura, { role: 'admin', v: 1 })).next).toHaveBeenCalled();
    expect((await pasar(requireLectura, { role: 'trabajador' })).next).not.toHaveBeenCalled();
  });

  it('anular los enlaces de socias (sociasVersion) los invalida sin tocar la sesión de admin', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 1, sociasVersion: 2 });
    expect((await pasar(requireLectura, { role: 'socias', v: 1, sv: 1 })).res.status).toHaveBeenCalledWith(401);
    expect((await pasar(requireLectura, { role: 'socias', v: 1, sv: 2 })).next).toHaveBeenCalled();
    expect((await pasar(requireAdmin, { role: 'admin', v: 1 })).next).toHaveBeenCalled();
  });

  it('cambiar la contraseña de admin también anula los enlaces de socias', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 2, sociasVersion: 1 });
    expect((await pasar(requireLectura, { role: 'socias', v: 1, sv: 1 })).res.status).toHaveBeenCalledWith(401);
  });
});
