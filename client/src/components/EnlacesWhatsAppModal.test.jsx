import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EnlacesWhatsAppModal from './EnlacesWhatsAppModal';

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pintar = (props = {}) =>
  render(<EnlacesWhatsAppModal abierto onCerrar={() => {}} workersList={equipo} weekId="week_3" weekName="Semana 3" {...props} />);

describe('EnlacesWhatsAppModal', () => {
  it('cerrado no pinta nada', () => {
    pintar({ abierto: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lista un enlace por trabajador y el de socias sin token si no hay sesión', () => {
    pintar();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\?socias$/)).toBeInTheDocument();
  });

  it('con sesión de admin el enlace de socias lleva el token', () => {
    guardarSesion(JSON.stringify({ token: 'abc', expiresAt: Date.now() + 60000 }));
    pintar();
    expect(screen.getByDisplayValue(/\?socias&token=abc$/)).toBeInTheDocument();
  });

  it('"Abrir" abre la vista del trabajador en su semana', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.click(screen.getAllByRole('button', { name: /Abrir/ })[0]);
    expect(abrir).toHaveBeenCalledWith(expect.stringContaining('?week=week_3&worker=Ana'), '_blank');
  });

  it('el botón de WhatsApp de un trabajador abre WhatsApp con su enlace', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.click(screen.getAllByRole('button', { name: /^WhatsApp$/ })[0]);
    const url = abrir.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?text=/);
    expect(decodeURIComponent(url)).toContain('Hola Ana');
    expect(decodeURIComponent(url)).toContain('Semana 3');
  });

  it('la X cierra', () => {
    const onCerrar = vi.fn();
    pintar({ onCerrar });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalled();
  });
});
