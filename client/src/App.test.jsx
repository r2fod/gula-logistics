import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from './test/render';

vi.mock('./data/pushService', () => ({ subscribeToPush: vi.fn().mockResolvedValue(null) }));
const { default: App } = await import('./App');

const equipo = [
  { name: 'Ana', role: 'Jefa', avatar: '🧭', isPayroll: true, rate: 14 },
  { name: 'Luis', role: 'Conductor', avatar: '🚚', isPayroll: false, rate: 12 },
];
const ir = (ruta = '/') => window.history.pushState({}, '', ruta);
const sesion = (clave) => localStorage.setItem(clave, JSON.stringify({ token: 'solo-pruebas', expiresAt: Date.now() + 3600e3 }));

describe('App — qué vista abre cada enlace', () => {
  beforeEach(() => {
    localStorage.clear();
    ir('/');
    localStorage.setItem('gula_workers_v1', JSON.stringify(equipo));
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red')))); // todo desde lo guardado en el dispositivo
  });

  it('BUG evitado: «Iniciar Nueva Tarea» de una tarjeta del panel abre la ventana de fichar con esa persona y NO salta a su vista de trabajador (antes: «me lleva a ella»)', async () => {
    sesion('gula_admin_token_v1');
    ir('/?tab=live');
    render(<App />);
    await screen.findByText(/Panel de Control Gula/);
    const botones = await screen.findAllByRole('button', { name: /Iniciar Nueva Tarea/ });
    fireEvent.click(botones[1]); // la tarjeta de Luis (las tarjetas van en el orden del equipo)
    expect(await screen.findByText('Fichar Jornada Operativa')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText('Seleccionar Trabajador')).toHaveValue('Luis');
    expect(screen.getByText(/Panel de Control Gula/)).toBeInTheDocument();
    expect(screen.queryByText(/Hola, Luis/)).toBeNull();
  });

  it('BUG evitado: el enlace de socias abre el panel aunque el dispositivo recuerde a una trabajadora', async () => {
    localStorage.setItem('gula_last_worker_v1', 'Luis');
    ir('/?socias&acceso=token.de.socias');
    render(<App />);
    await screen.findByText(/Panel de Control Gula/);
    expect(screen.queryByText(/Hola, Luis/)).toBeNull();
    expect(localStorage.getItem('gula_last_worker_v1')).toBeNull(); // y se olvida: la app instalada no vuelve a ella
  });

  it('con enlace de socias guardado, abrir la app sin parámetros abre el panel y no a la trabajadora recordada', async () => {
    sesion('gula_socias_token_v1');
    localStorage.setItem('gula_last_worker_v1', 'Luis');
    render(<App />);
    await screen.findByText(/Panel de Control Gula/);
    expect(screen.queryByText(/Hola, Luis/)).toBeNull();
  });

  it('BUG evitado: un ?socias viejo, sin acceso=, enseña el aviso de que ya no da acceso (antes, un panel vacío)', async () => {
    ir('/?socias');
    render(<App />);
    expect(await screen.findByText(/Este enlace de socias ya no da acceso/)).toBeInTheDocument();
    expect(screen.queryByText(/Panel de Control Gula/)).toBeNull();
  });

  it('el enlace de una trabajadora abre SU vista, y la app instalada sin parámetros vuelve a ella', async () => {
    ir('/?worker=Luis');
    const { unmount } = render(<App />);
    expect(await screen.findByText(/Hola, Luis/)).toBeInTheDocument();
    expect(localStorage.getItem('gula_last_worker_v1')).toBe('Luis');
    unmount();
    ir('/'); // el icono de la app instalada abre sin parámetros
    render(<App />);
    expect(await screen.findByText(/Hola, Luis/)).toBeInTheDocument();
  });
});
