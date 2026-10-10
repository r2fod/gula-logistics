import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '../../test/render';
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

  it('si está fichado ahora, el saldo sube en directo con lo que lleva el turno y se ve lo ya cerrado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0));
    pintar({ turnosAbiertos: { Ana: { workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 28, 9, 30).toISOString() } } });
    expect(screen.getByText('0h 30m 00s')).toBeInTheDocument();
    expect(screen.getByText('+5,00 €')).toBeInTheDocument();
    expect(screen.getByText('+50,00 €')).toBeInTheDocument(); // 45 cerrado + 5 del turno
    expect(screen.getByText('Cerrado: +45,00 €')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(36 * 1000); }); // 36 s a 10 €/h = 10 céntimos
    expect(screen.getByText('+50,10 €')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('un turno abierto más de 16 h (salida olvidada) avisa y no se suma al saldo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0));
    pintar({ turnosAbiertos: { Ana: { workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 27, 9, 0).toISOString() } } });
    expect(screen.getByRole('status').textContent).toMatch(/olvidó fichar la salida/);
    expect(screen.getByText('+45,00 €')).toBeInTheDocument();
    expect(screen.queryByText(/Cerrado:/)).toBeNull();
    vi.useRealTimers();
  });

  it('en nómina fija: se ve que está en turno, pero sin euros subiendo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0));
    render(<TeamBalancesTab
      balancesData={{ workers: [{ ...ficha, statusType: 'payroll' }] }} adminUnlocked onOpenShareModal={vi.fn()} onDeleteClockEntry={vi.fn()}
      persistWorkerBalance={vi.fn()} findWorkerHours={() => horas}
      turnosAbiertos={{ Ana: { workerName: 'Ana', type: 'entrada', rate: 14, timestamp: new Date(2026, 8, 28, 9, 30).toISOString() } }}
    />);
    expect(screen.getByText('0h 30m 00s')).toBeInTheDocument();
    expect(screen.queryByText('+7,00 €')).toBeNull();
    expect(screen.queryByText(/Ya va en el saldo/)).toBeNull();
    vi.useRealTimers();
  });
});

describe('TeamBalancesTab — bolsa de horas por meses', () => {
  // Bolsa de 10 h a 8 €/h y luego 12 €/h; acuerdo de septiembre a octubre; las 10 h de septiembre, a mano.
  const conBolsa = {
    id: 'luis', name: 'Luis', role: 'Apoyo', avatar: '👤', statusType: 'neutral', currentBalance: 80,
    isSpecialPurse: true,
    purseInfo: { totalHours: 10, consumedHours: 10, consumedValue: 80, hourlyRate: 8, extraRateAfter80h: 12, grossBase: 0, housingDeduction: 0, netFixedAt80h: 0, shifts: [], desde: '2026-09', hasta: '2026-10' },
    breakdown: [{ concept: 'Valor Acumulado Horas Bolsa (10h a 8€/h)', amount: 80, tipo: 'bolsa' }],
  };
  const deOctubre = {
    totalHours: 6, completedShifts: 1,
    shifts: [{ startDate: '2/10/2026', startTime: '09:00', endTime: '15:00', durationHours: 6, cost: 72, rate: 12, entryIds: ['e1', 'e2'], startEntry: { timestamp: new Date(2026, 9, 2, 9).toISOString() } }],
  };
  const apuntarTurno = (fecha, entrada, salida) => {
    fireEvent.click(screen.getByRole('button', { name: /Añadir concepto \/ horas manual/ }));
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: fecha } });
    const [ini, fin] = document.querySelectorAll('input[type="time"]');
    fireEvent.change(ini, { target: { value: entrada } });
    fireEvent.change(fin, { target: { value: salida } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  };

  it('los fichados de octubre gastan la bolsa de octubre (antes iban todos a la tarifa extra)', () => {
    pintar({ balancesData: { workers: [conBolsa] }, findWorkerHours: () => deOctubre });
    expect(screen.getByText(/2\/10\/2026 \[09:00 a 15:00\] - 6h a 8€\/h \(Bolsa\)/)).toBeInTheDocument();
    expect(screen.getByText('+128,00 €')).toBeInTheDocument(); // 80 a mano + 6 h a 8
  });

  it('un turno a mano de octubre gasta lo que queda de la bolsa de octubre y va en su propio concepto con fecha (no toca las horas a mano de septiembre)', async () => {
    const p = pintar({ balancesData: { workers: [conBolsa] }, findWorkerHours: () => deOctubre });
    apuntarTurno('2026-10-10', '09:00', '15:00'); // 6 h: quedan 4 de bolsa → 4 a 8 + 2 a 12
    await waitFor(() => expect(p.persistWorkerBalance).toHaveBeenCalled());
    const [, cambios] = p.persistWorkerBalance.mock.calls[0];
    expect(cambios.purseInfo).toBeUndefined();
    expect(cambios.breakdown.at(-1)).toMatchObject({ amount: 4 * 8 + 2 * 12, tipo: 'turno', date: '2026-10-10', horasBolsa: 4 });
    expect(cambios.breakdown.at(-1).concept).toBe('🕒 10/10 (09:00 a 15:00 - 4h a 8€/h + 2h a 12€/h)');
    expect(cambios.currentBalance).toBe(80 + 56);
  });

  it('un turno a mano del primer mes sigue el camino de siempre (bolsa de septiembre llena: extra)', async () => {
    const p = pintar({ balancesData: { workers: [conBolsa] }, findWorkerHours: () => deOctubre });
    apuntarTurno('2026-09-25', '09:00', '11:00');
    await waitFor(() => expect(p.persistWorkerBalance).toHaveBeenCalled());
    const [, cambios] = p.persistWorkerBalance.mock.calls[0];
    expect(cambios.breakdown.at(-1)).toMatchObject({ amount: 24, tipo: 'turno', date: '2026-09-25' });
    expect(cambios.breakdown.at(-1).concept).toMatch(/Extra tras bolsa/);
  });

  it('guardar los meses del acuerdo manda el purseInfo completo con desde/hasta y avisa si el servidor aún no los guarda', async () => {
    const sinMeses = { ...conBolsa, purseInfo: { ...conBolsa.purseInfo, desde: '', hasta: '' } };
    const p = pintar({ balancesData: { workers: [sinMeses] }, findWorkerHours: () => deOctubre, persistWorkerBalance: vi.fn().mockResolvedValue({ purseInfo: { totalHours: 10 } }) });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09' } });
    fireEvent.change(screen.getByLabelText('Hasta (incluido)'), { target: { value: '2026-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar meses' }));
    await waitFor(() => expect(p.persistWorkerBalance).toHaveBeenCalledWith('luis', { purseInfo: { ...sinMeses.purseInfo, desde: '2026-09', hasta: '2026-10' } }));
    expect(await screen.findByText(/El servidor todavía no guarda los meses/)).toBeInTheDocument();
  });
});


describe('TeamBalancesTab — fecha del turno a mano', () => {
  it('BUG evitado: de madrugada propone HOY en hora de aquí (antes, en UTC: el día anterior, y el 1 de mes caía en el mes anterior)', () => {
    const tzAntes = process.env.TZ;
    process.env.TZ = 'Europe/Madrid';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T23:30:00Z')); // 1 de noviembre, 00:30 en España
    try {
      pintar();
      fireEvent.click(screen.getByRole('button', { name: /Añadir concepto \/ horas manual/ }));
      expect(document.querySelector('input[type="date"]').value).toBe('2026-11-01');
    } finally {
      vi.useRealTimers();
      process.env.TZ = tzAntes;
    }
  });
});
