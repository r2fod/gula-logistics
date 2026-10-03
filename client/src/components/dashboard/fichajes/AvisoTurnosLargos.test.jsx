import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/render';
import AvisoTurnosLargos from './AvisoTurnosLargos';

const f = (id, type, iso, extra = {}) => ({ id, workerName: 'Eva', type, timestamp: iso, ...extra });

describe('AvisoTurnosLargos', () => {
  it('avisa de un turno de más de 14 h y «Revisar» lleva a revisarlo', () => {
    const revisar = vi.fn();
    render(<AvisoTurnosLargos fichajes={[f('1', 'entrada', '2026-09-26T02:30:00Z'), f('2', 'salida', '2026-09-26T21:30:00Z')]} onRevisar={revisar} />);
    expect(screen.getByText(/Un turno muy largo/)).toBeTruthy();
    expect(screen.getByText(/se paga entero/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(revisar).toHaveBeenCalled();
  });

  it('sin turnos largos (o ya dados por buenos) no enseña nada', () => {
    const { container } = render(<AvisoTurnosLargos fichajes={[f('1', 'entrada', '2026-09-26T02:30:00Z', { revisado: true }), f('2', 'salida', '2026-09-26T21:30:00Z'), f('3', 'entrada', '2026-09-27T08:00:00Z', { workerName: 'Luis' }), f('4', 'salida', '2026-09-27T12:00:00Z', { workerName: 'Luis' })]} onRevisar={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
