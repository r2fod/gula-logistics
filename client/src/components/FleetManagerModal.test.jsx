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

describe('FleetManagerModal — el día de recogida y de devolución, con festivos', () => {
  // Semana del 6 al 11 de octubre de 2026: viernes 9 y lunes 12 (cola) son festivos.
  const conFechas = (camion) => ({ id: 'week_6', meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' }, trucks: [{ name: 'Camión Alquiler', tag: 'ALQUILER', ...camion }] });
  const abrir = (camion = {}) => {
    const onUpdateWeek = vi.fn();
    render(<FleetManagerModal isOpen onClose={vi.fn()} activeWeekData={conFechas(camion)} onUpdateWeek={onUpdateWeek} />);
    const [recogida, devolucion] = screen.getAllByRole('combobox').filter(s => [...s.options].some(o => /Martes/.test(o.textContent)));
    return { recogida, devolucion, onUpdateWeek };
  };
  const opcion = (selector, texto) => [...selector.options].find(o => o.textContent.startsWith(texto));

  it('BUG evitado: un festivo no se puede elegir (el alquiler cierra); cada día lleva su número', () => {
    const { recogida, devolucion, onUpdateWeek } = abrir();
    expect(opcion(devolucion, 'Lunes').textContent).toBe('Lunes 12 · festivo'); // el lunes de la cola
    expect(opcion(devolucion, 'Lunes').disabled).toBe(true);
    expect(opcion(devolucion, 'Viernes').disabled).toBe(true);
    expect(opcion(devolucion, 'Martes').textContent).toBe('Martes 6');
    expect(opcion(recogida, 'Lunes').textContent).toBe('Lunes 5'); // el de la víspera: no es festivo
    expect(opcion(recogida, 'Lunes').disabled).toBe(false);
    fireEvent.change(devolucion, { target: { value: 'Domingo' } });
    expect(onUpdateWeek).toHaveBeenCalledWith('week_6', { trucks: [expect.objectContaining({ returnDay: 'Domingo' })] });
  });

  it('si el día que ya estaba puesto es festivo, lo avisa (y se puede cambiar)', () => {
    const { devolucion } = abrir({ returnDay: 'Lunes' });
    expect(devolucion.value).toBe('Lunes');
    expect(screen.getByRole('alert')).toHaveTextContent('Es festivo (Fiesta Nacional de España): el alquiler cierra. Elige otro día.');
  });
});


describe('FleetManagerModal — guardar la matrícula', () => {
  it('BUG evitado: escribir no guarda la semana en cada letra (chocaban entre sí con 409); guarda una vez al salir del campo', () => {
    const onUpdateWeek = vi.fn();
    render(<FleetManagerModal isOpen onClose={vi.fn()} activeWeekData={semana()} onUpdateWeek={onUpdateWeek} />);
    const campo = screen.getByDisplayValue('Camión Alquiler');
    fireEvent.change(campo, { target: { value: 'Camión A' } });
    fireEvent.change(campo, { target: { value: 'Camión AB' } });
    expect(onUpdateWeek).not.toHaveBeenCalled();
    fireEvent.blur(campo);
    expect(onUpdateWeek).toHaveBeenCalledTimes(1);
    expect(onUpdateWeek.mock.calls[0][1].trucks[0].name).toBe('Camión AB');
  });

  it('si la ventana se cierra con el campo a medias, lo escrito se guarda igual', () => {
    const onUpdateWeek = vi.fn();
    const { unmount } = render(<FleetManagerModal isOpen onClose={vi.fn()} activeWeekData={semana()} onUpdateWeek={onUpdateWeek} />);
    fireEvent.change(screen.getByDisplayValue('Camión Alquiler'), { target: { value: 'Camión Z' } });
    unmount();
    expect(onUpdateWeek).toHaveBeenCalledTimes(1);
    expect(onUpdateWeek.mock.calls[0][1].trucks[0].name).toBe('Camión Z');
  });
});
