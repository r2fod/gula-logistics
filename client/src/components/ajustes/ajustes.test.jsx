import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '../../test/render';

vi.mock('../../data/apiService', () => ({ changeAdminPassword: vi.fn().mockResolvedValue({ success: true }) }));

import BaseDeDatos from './BaseDeDatos';
import CambiarClave from './CambiarClave';
import { changeAdminPassword } from '../../data/apiService';

const f = (id, workerName, type, hora) => ({ id, workerName, type, timestamp: `2026-09-20T${hora}Z` });
const equipo = [{ name: 'Ana' }];

describe('Configuración → Base de datos', () => {
  it('todo en orden: lo dice y no ofrece acciones', () => {
    render(<BaseDeDatos fichajes={[]} equipo={equipo} fichas={[{ name: 'Ana Gula' }]} />);
    expect(screen.getByText('Todo en orden')).toBeTruthy();
    expect(screen.getByText('Optimizada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vaciar' })).toBeNull();
  });

  it('vaciar la papelera y mover lo que sobra piden la misma confirmación que en Fichajes', async () => {
    const vaciar = vi.fn(); const mover = vi.fn();
    render(<BaseDeDatos fichajes={[f('1', 'Ana', 'entrada', '08:00:00'), f('2', 'Ana', 'salida', '08:00:05')]} borrados={[{ id: 'b' }]} equipo={equipo} fichas={[{ name: 'Ana' }]} onVaciarPapelera={vaciar} onMoverAPapelera={mover} />);
    expect(screen.getByText('2 cosas para mirar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vaciar' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Vaciar papelera' })).getByRole('button', { name: 'Borrar para siempre' }));
    await waitFor(() => expect(vaciar).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'A la papelera' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Limpiar fichajes' })).getByRole('button', { name: 'Mover a la papelera' }));
    await waitFor(() => expect(mover).toHaveBeenCalledWith(['1', '2']));
  });
});

describe('Cambiar la clave de admin', () => {
  it('va plegada; al abrirla valida antes de guardar', async () => {
    const hecho = vi.fn();
    render(<CambiarClave onHecho={hecho} />);
    const abrir = screen.getByRole('button', { name: /Cambiar la clave de admin/ });
    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(abrir);
    fireEvent.click(screen.getByRole('button', { name: /Guardar la clave nueva/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/contraseña actual/);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'vieja-de-prueba' } });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'nueva-de-prueba' } });
    fireEvent.change(screen.getByLabelText('Repite la nueva'), { target: { value: 'otra-cosa' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar la clave nueva/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/no coinciden/);
    fireEvent.change(screen.getByLabelText('Repite la nueva'), { target: { value: 'nueva-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar la clave nueva/ }));
    await waitFor(() => expect(hecho).toHaveBeenCalled());
    expect(changeAdminPassword).toHaveBeenCalledWith('vieja-de-prueba', 'nueva-de-prueba');
  });
});
