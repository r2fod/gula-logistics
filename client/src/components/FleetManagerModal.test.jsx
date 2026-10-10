import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '../test/render';
import FleetManagerModal from './FleetManagerModal';

afterEach(cleanup);

describe('FleetManagerModal', () => {
  it('BUG evitado: «Ver Documento» abre el PDF en el servidor, no en la web de la app (daba 404)', () => {
    const semana = { id: 'week_1', trucks: [{ name: 'Camión Alquiler', tag: 'ALQUILER', pdfUrl: '/uploads/rental-1.pdf' }] };
    render(<FleetManagerModal isOpen onClose={vi.fn()} activeWeekData={semana} onUpdateWeek={vi.fn()} />);
    const enlace = new URL(screen.getByRole('link', { name: 'Ver Documento' }).href);
    expect(enlace.pathname).toBe('/uploads/rental-1.pdf');
    expect(enlace.origin).not.toBe(window.location.origin);
  });
});
