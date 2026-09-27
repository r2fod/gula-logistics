import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '../../test/render';
import TeamBalancesTab from './TeamBalancesTab';

const ficha = {
  id: 'ana', name: 'Ana', role: 'Conductora', avatar: '🚚', statusType: 'success', currentBalance: 25,
  breakdown: [{ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 }, { concept: 'Rotura de copas', amount: -10 }],
};
const horas = {
  totalHours: 2, completedShifts: 1,
  shifts: [{ startDate: '15/09/2026', startTime: '09:00', endTime: '11:00', durationHours: 2, cost: 20, rate: 10, entryIds: ['e1', 'e2'], startEntry: { timestamp: new Date(2026, 8, 15, 9).toISOString() } }],
};

const pintar = (props = {}) => {
  const p = {
    balancesData: { workers: [ficha] }, adminUnlocked: true, onOpenShareModal: vi.fn(), onDeleteClockEntry: vi.fn(),
    persistWorkerBalance: vi.fn().mockResolvedValue(true), findWorkerHours: () => horas, onVerEnResumen: vi.fn(), ...props,
  };
  render(<TeamBalancesTab {...p} />);
  return p;
};

describe('TeamBalancesTab — desglose separado', () => {
  it('separa lo fichado (se suma solo) de lo apuntado a mano, cada parte con su subtotal, y el saldo es la suma', () => {
    pintar();
    const fichados = screen.getByText('Turnos fichados').closest('div').parentElement;
    const aMano = screen.getByText('Apuntado a mano').closest('div').parentElement;
    expect(within(fichados).getByText(/15\/09\/2026 \[09:00 a 11:00\]/)).toBeInTheDocument();
    expect(within(fichados).getAllByText('+20,00 €').length).toBeGreaterThan(0);
    expect(within(aMano).getByText('Rotura de copas')).toBeInTheDocument();
    expect(within(aMano).getAllByText('+25,00 €').length).toBeGreaterThan(0); // 35 - 10
    expect(screen.getByText('+45,00 €')).toBeInTheDocument(); // saldo: 20 fichado + 25 a mano
  });

  it('BUG evitado: borrar un concepto a mano borra ESE concepto (antes el índice se calculaba restando los fichajes)', async () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar concepto manual: Rotura de copas' }));
    await waitFor(() => expect(p.persistWorkerBalance).toHaveBeenCalled());
    const [id, cambios] = p.persistWorkerBalance.mock.calls[0];
    expect(id).toBe('ana');
    expect(cambios.breakdown.map(b => b.concept)).toEqual(['🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)']);
    expect(cambios.currentBalance).toBe(35);
  });

  it('borrar un turno fichado pide confirmación y borra sus fichajes', async () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: /Borrar jornada fichada/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Confirmación' })).getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(p.onDeleteClockEntry).toHaveBeenCalledTimes(2));
  });

  it('"Ver sus horas por evento" lleva al Resumen con esa persona; sin admin no se puede borrar', () => {
    const p = pintar({ adminUnlocked: false });
    fireEvent.click(screen.getByRole('button', { name: 'Ver las horas de Ana por evento en el Resumen Financiero' }));
    expect(p.onVerEnResumen).toHaveBeenCalledWith('Ana');
    expect(screen.queryByRole('button', { name: /Eliminar concepto manual/ })).toBeNull();
  });

  it('un pago en efectivo ("Adelanto") se sigue descontando del saldo igual que antes (ahora además guarda tipo y fecha)', async () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: /Añadir concepto \/ horas manual/ }));
    fireEvent.click(screen.getByRole('button', { name: /Adelanto/ }));
    fireEvent.change(screen.getByPlaceholderText(/Concepto \(ej: Adelanto nómina, Pago Bizum\)/), { target: { value: 'Pago en efectivo' } });
    fireEvent.change(screen.getByPlaceholderText(/Importe a RESTAR/), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Adelanto' }));
    await waitFor(() => expect(p.persistWorkerBalance).toHaveBeenCalled());
    const [, cambios] = p.persistWorkerBalance.mock.calls[0];
    expect(cambios.breakdown.at(-1)).toMatchObject({ concept: 'Pago en efectivo', amount: -50, isPositive: false, tipo: 'pago' });
    expect(cambios.breakdown.at(-1).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cambios.currentBalance).toBe(35 - 10 - 50); // lo que se le debe baja 50 €
  });

  it('si está fichado ahora, enseña lo que lleva de este turno subiendo en directo (sin tocar el saldo)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0));
    pintar({ turnosAbiertos: { Ana: { workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 28, 9, 30).toISOString() } } });
    expect(screen.getByText('En turno ahora')).toBeInTheDocument();
    expect(screen.getByText('+5,00 € y subiendo')).toBeInTheDocument();
    expect(screen.getByText('+45,00 €')).toBeInTheDocument(); // el saldo no cambia hasta fichar la salida
    vi.useRealTimers();
  });
});
