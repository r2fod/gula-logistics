import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '../test/render';

vi.mock('../data/apiService', () => ({
  changeAdminPassword: vi.fn(),
  cerrarSesionesEnAPI: vi.fn().mockResolvedValue({ ok: true }),
  fetchAjustesAdmin: vi.fn().mockResolvedValue({ exigirEnlaceAlFichar: false }),
  guardarAjustesAdmin: vi.fn().mockResolvedValue({ exigirEnlaceAlFichar: true }),
}));

import AdminSettingsModal from './AdminSettingsModal';
import { cerrarSesionesEnAPI, guardarAjustesAdmin } from '../data/apiService';

describe('AdminSettingsModal', () => {
  it('«Cerrar todas las sesiones» pide confirmación, las cierra sin cambiar la clave y renueva el enlace de socias', async () => {
    const renovar = vi.fn();
    render(<AdminSettingsModal isOpen onClose={vi.fn()} onSesionesCerradas={renovar} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar todas las sesiones/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cerrar todas las sesiones' });
    expect(within(dialogo).getByText(/la clave no cambia/)).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesiones' }));
    await waitFor(() => expect(cerrarSesionesEnAPI).toHaveBeenCalled());
    await waitFor(() => expect(renovar).toHaveBeenCalled());
  });

  it('exigir el enlace para fichar avisa de quién se quedaría sin poder fichar antes de activarlo', async () => {
    const hoy = new Date().toISOString();
    render(<AdminSettingsModal isOpen onClose={vi.fn()} fichajes={[{ workerName: 'Luis', timestamp: hoy, firmado: false }, { workerName: 'Ana', timestamp: hoy, firmado: true }]} />);
    expect(screen.getByText(/Ya fichan con su enlace: Ana/)).toBeTruthy();
    expect(screen.getByText(/Aún fichan sin él: Luis/)).toBeTruthy();
    const interruptor = screen.getByRole('switch', { name: /Exigir el enlace/ });
    await waitFor(() => expect(interruptor.disabled).toBe(false));
    fireEvent.click(interruptor);
    const dialogo = await screen.findByRole('dialog', { name: 'Exigir el enlace para fichar' });
    expect(within(dialogo).getByText(/Luis aún ficha sin su enlace/)).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(guardarAjustesAdmin).toHaveBeenCalledWith({ exigirEnlaceAlFichar: true }));
    await waitFor(() => expect(interruptor.getAttribute('aria-checked')).toBe('true'));
  });
});
