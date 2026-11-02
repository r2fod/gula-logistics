import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerViewWeddingCard from './WorkerViewWeddingCard';

const boda = { location: 'Finca Sur', truck: 'Camión Uno', timeFrame: '11:00-20:00', assigned: ['Ana'] };
const pintar = (props = {}) => {
  const p = {
    wedding: boda, isCompleted: false, isDayInFuture: false, jornadaGateClosed: false, gateText: '',
    onToggleTask: vi.fn(), onClockIn: vi.fn(), resolveRealTaskIndex: vi.fn(() => 2),
    getWeddingTaskName: (w) => `Boda: ${w.location} (${w.truck})`, jornadaStarted: false, ...props,
  };
  render(<WorkerViewWeddingCard {...p} />);
  return p;
};

describe('WorkerViewWeddingCard', () => {
  it('BUG evitado: pulsar la boda la marca con su índice real (antes "resolveRealTaskIndex is not defined")', () => {
    const p = pintar();
    fireEvent.click(screen.getByText('Finca Sur'));
    expect(p.resolveRealTaskIndex).toHaveBeenCalledWith('sabado', boda); // la boda, no su texto: dos con el mismo nombre no se confunden
    expect(p.onToggleTask).toHaveBeenCalledWith('sabado', 2);
  });

  it('fichar la boda manda su referencia real', () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: /Fichar/ }));
    expect(p.onClockIn).toHaveBeenCalledWith('Boda: Finca Sur (Camión Uno)', { dayKey: 'sabado', taskIndex: 2 });
  });

  it('BUG evitado: la boda se marca también con el teclado (antes era un div sin foco ni Enter)', () => {
    const p = pintar();
    const tarjeta = screen.getByRole('button', { name: /Finca Sur/ });
    expect(tarjeta).toHaveAttribute('tabindex', '0');
    expect(tarjeta).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(tarjeta, { key: 'Enter' });
    fireEvent.keyDown(tarjeta, { key: ' ' });
    fireEvent.keyDown(tarjeta, { key: 'a' });
    expect(p.onToggleTask).toHaveBeenCalledTimes(2);
  });

  it('con la jornada ya empezada no aparece el botón de fichar', () => {
    pintar({ jornadaStarted: true });
    expect(screen.queryByRole('button', { name: /Fichar/ })).toBeNull();
  });
});
