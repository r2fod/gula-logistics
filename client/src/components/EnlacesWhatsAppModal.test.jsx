import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '../test/render';

const crearToken = vi.fn();
vi.mock('../data/apiService', () => ({ crearTokenSociasEnAPI: (...a) => crearToken(...a) }));
const { default: EnlacesWhatsAppModal } = await import('./EnlacesWhatsAppModal');

const equipo = [
  { name: 'Ana', role: 'Conductora', avatar: '🚚', isPayroll: false },
  { name: 'Luis', role: 'Base', avatar: '👤', isPayroll: true },
];

// Este entorno de test no trae un localStorage completo.
const guardarSesion = (valor) =>
  vi.stubGlobal('localStorage', { getItem: () => valor, setItem: () => {}, removeItem: () => {} });

beforeEach(() => {
  window.history.replaceState({}, '', '/gula-logistics/');
  guardarSesion(null);
  crearToken.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pintar = (props = {}) =>
  render(<EnlacesWhatsAppModal abierto onCerrar={() => {}} workersList={equipo} {...props} />);

describe('EnlacesWhatsAppModal', () => {
  it('cerrado no pinta nada', () => {
    pintar({ abierto: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin sesión de admin lista los trabajadores y NO ofrece enlace de socias', () => {
    pintar();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.queryByLabelText('Enlace para socias')).toBeNull();
    expect(crearToken).not.toHaveBeenCalled();
  });

  it('BUG evitado: con admin el enlace de socias es el de SOLO LECTURA que da el servidor, nunca la sesión de admin', async () => {
    guardarSesion(JSON.stringify({ token: 'SESION-ADMIN', expiresAt: Date.now() + 60000 }));
    crearToken.mockResolvedValue({ ok: true, token: 'solo.lectura', expiresAt: new Date(2026, 11, 26).getTime() });
    pintar({ admin: true });
    const campo = await screen.findByDisplayValue(/\?socias&acceso=solo\.lectura$/);
    expect(campo.value).not.toContain('SESION-ADMIN');
    expect(crearToken).toHaveBeenCalledWith({ anularAnteriores: false });
    expect(screen.getByText(/Caduca el/)).toBeInTheDocument();
  });

  it('"Anular anteriores" pide confirmación y genera uno nuevo anulando los enviados', async () => {
    crearToken.mockResolvedValue({ ok: true, token: 'a.b', expiresAt: Date.now() + 1000 });
    pintar({ admin: true });
    await screen.findByDisplayValue(/acceso=a\.b$/);
    fireEvent.click(screen.getByRole('button', { name: /Anular anteriores/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Confirmación' })).getByRole('button', { name: 'Anular y generar' }));
    await waitFor(() => expect(crearToken).toHaveBeenLastCalledWith({ anularAnteriores: true }));
  });

  it('si el servidor no lo genera, lo dice y no deja copiar un enlace vacío', async () => {
    crearToken.mockResolvedValue({ ok: false, error: 'sin conexión' });
    pintar({ admin: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión');
    expect(screen.getByRole('button', { name: /Copiar Link Socias/ })).toBeDisabled();
  });

  it('"Abrir" abre su enlace fijo, sin semana', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.click(screen.getAllByRole('button', { name: /Abrir/ })[0]);
    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/\?worker=Ana$/), '_blank');
  });

  it('el botón de WhatsApp de un trabajador abre WhatsApp con su enlace', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.click(screen.getAllByRole('button', { name: /^WhatsApp$/ })[0]);
    const url = abrir.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?text=/);
    expect(decodeURIComponent(url)).toContain('Hola Ana');
    expect(decodeURIComponent(url)).toContain('?worker=Ana');
    expect(decodeURIComponent(url)).not.toContain('week');
    expect(decodeURIComponent(url)).toContain('siempre el mismo');
  });

  it('la X cierra', () => {
    const onCerrar = vi.fn();
    pintar({ onCerrar });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalled();
  });
});
