import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/render';
import ClockInModal from './ClockInModal';

const equipo = [{ name: 'Ana', role: 'Mozo', rate: 10 }];

describe('ClockInModal', () => {
  it('BUG evitado: abrir la ventana de fichar (montada cerrada, como en App) no tumba la app', () => {
    const props = { onClose: vi.fn(), workersList: equipo, clockEntries: [], onClockEntryCreated: vi.fn() };
    const { rerender } = render(<ClockInModal {...props} isOpen={false} />);
    expect(() => rerender(<ClockInModal {...props} isOpen />)).not.toThrow();
    expect(screen.getByText('Fichar Jornada Operativa')).toBeTruthy();
  });
});
