import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { signToken, verifyToken, timingSafeStringEqual } from './authToken.js';

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
});

describe('signToken / verifyToken', () => {
  it('firma un payload y lo verifica devolviendo los mismos datos + exp', () => {
    const token = signToken({ role: 'admin', v: 1 });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ role: 'admin', v: 1 });
    expect(payload.exp).toBeGreaterThan(Date.now());
  });

  it('rechaza un token caducado', () => {
    const token = signToken({ role: 'admin' }, -1); // ttl negativo: ya caducado
    expect(verifyToken(token)).toBeNull();
  });

  it('rechaza un token con la firma manipulada', () => {
    const token = signToken({ role: 'admin' });
    const [body] = token.split('.');
    const tampered = `${body}.firmafalsa`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rechaza un token cuyo payload fue alterado sin volver a firmar (cambiar role a admin)', () => {
    const token = signToken({ role: 'worker' });
    const [body, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const forgedBody = Buffer.from(JSON.stringify({ ...decoded, role: 'admin' })).toString('base64url');
    expect(verifyToken(`${forgedBody}.${signature}`)).toBeNull();
  });

  it('rechaza un token firmado con un secreto distinto (p.ej. tras rotar AUTH_TOKEN_SECRET)', () => {
    const token = signToken({ role: 'admin' });
    process.env.AUTH_TOKEN_SECRET = 'otro-secreto-distinto';
    expect(verifyToken(token)).toBeNull();
  });

  it('devuelve null ante entradas inválidas sin lanzar excepción', () => {
    expect(verifyToken(null)).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('sin-punto-no-es-un-token')).toBeNull();
    expect(verifyToken(42)).toBeNull();
  });

  it('lanza un error claro si AUTH_TOKEN_SECRET no está configurado', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    expect(() => signToken({ role: 'admin' })).toThrow(/AUTH_TOKEN_SECRET/);
  });
});

describe('timingSafeStringEqual', () => {
  it('devuelve true solo si las cadenas son idénticas', () => {
    expect(timingSafeStringEqual('clave123', 'clave123')).toBe(true);
    expect(timingSafeStringEqual('clave123', 'clave124')).toBe(false);
  });

  it('devuelve false (no lanza) si las cadenas tienen longitud distinta', () => {
    expect(timingSafeStringEqual('corta', 'una-cadena-mucho-mas-larga')).toBe(false);
  });

  it('compara con tiempo constante (no hace early-return con "==="), evitando timing attacks', () => {
    // No podemos medir microsegundos de forma fiable en CI, pero sí podemos
    // comprobar que usa crypto.timingSafeEqual y no una comparación directa.
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    timingSafeStringEqual('a', 'a');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
