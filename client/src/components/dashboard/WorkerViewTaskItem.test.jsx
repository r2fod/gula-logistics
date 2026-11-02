import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerViewTaskItem from './WorkerViewTaskItem';

const tarea = { id: 's2', text: 'Devolución', timeFrame: '10:00 - 11:00', assigned: ['Ana'] };
const pintar = (props = {}) => {
  const p = {
    task: tarea, dayKey: 'lunes', isCompleted: false, isDayInFuture: false, jornadaGateClosed: false, gateText: '',
    onToggleTask: vi.fn(), onClockIn: vi.fn(), resolveRealTaskIndex: vi.fn(() => 3),
    toStorageDayKey: (k) => (k === 'lunes' ? 'domingo' : k), jornadaStarted: false, ...props,
  };
  render(<ul><WorkerViewTaskItem {...p} /></ul>);
  return p;
};

describe('WorkerViewTaskItem', () => {
  it('BUG evitado: la tarea se marca también con el teclado (antes era un div sin foco ni Enter)', () => {
    const p = pintar();
    const tarjeta = screen.getByRole('button', { name: /Devolución/ });
    expect(tarjeta).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(tarjeta, { key: 'Enter' });
    fireEvent.keyDown(tarjeta, { key: ' ' });
    fireEvent.keyDown(tarjeta, { key: 'Tab' });
    expect(p.onToggleTask).toHaveBeenCalledTimes(2);
    expect(p.onToggleTask).toHaveBeenCalledWith('domingo', 3); // el lunes se guarda en la lista del domingo
  });

  it('hecha: aria-pressed lo dice', () => {
    pintar({ isCompleted: true });
    expect(screen.getByRole('button', { name: /Devolución/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sin onToggleTask es solo lectura: ni rol de botón ni foco', () => {
    pintar({ onToggleTask: undefined });
    expect(screen.queryByRole('button', { name: /Devolución/ })).toBeNull();
  });

  it('un día que no ha llegado enseña el aviso en vez de «Fichar»', () => {
    pintar({ isDayInFuture: true });
    expect(screen.getByText(/Aún no ha llegado este día/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fichar/ })).toBeNull();
  });
});
