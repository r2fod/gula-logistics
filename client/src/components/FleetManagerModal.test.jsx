import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '../test/render';
import FleetManagerModal from './FleetManagerModal';
import { setStoredAdminToken } from '../data/apiService';

const semana = (pdfUrl) => ({ id: 'week_1', trucks: [{ name: 'Camión Alquiler', tag: 'ALQUILER', pdfUrl }] });
const pintar = (pdfUrl) => render(<FleetManagerModal isOpen onClose={vi.fn()} activeWeekData={semana(pdfUrl)} onUpdateWeek={vi.fn()} />);

let ventana;
beforeEach(() => {
  localStorage.clear();
  setStoredAdminToken('token-de-prueba', Date.now() + 60_000);
  ventana = { opener: window, location: { href: '' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(ventana);
  URL.createObjectURL = vi.fn(() => 'blob:local/pdf-1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FleetManagerModal — PDF del alquiler', () => {
  it('BUG evitado: «Ver Documento» pide el PDF al servidor con la sesión de admin y lo abre en otra pestaña (antes, un enlace a la web de la app: 404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['%PDF-1.4']) });
    pintar('/api/logistics/documentos/' + 'a'.repeat(32));
    expect(screen.getByText('Contrato (PDF)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver Documento' }));
    expect(window.open).toHaveBeenCalledWith('', '_blank'); // en el clic: si no, se bloquea
    await waitFor(() => expect(ventana.location.href).toBe('blob:local/pdf-1'));
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/logistics/documentos/' + 'a'.repeat(32));
    expect(new URL(url).origin).not.toBe(window.location.origin);
    expect(opciones.headers.Authorization).toBe('Bearer token-de-prueba');
    expect(ventana.opener).toBeNull();
  });

  it('si el archivo ya no está (los viejos del disco de Render), cierra la pestaña y lo dice', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    pintar('/uploads/rental-1.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Ver Documento' }));
    expect(await screen.findByText(/vuelve a subirlo/)).toBeInTheDocument();
    expect(ventana.close).toHaveBeenCalled();
  });
});
