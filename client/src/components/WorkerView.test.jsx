import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../test/render';

vi.mock('../data/pushService', () => ({ subscribeToPush: vi.fn().mockResolvedValue(null) }));
vi.mock('./TaskFlowGraphView', () => ({ default: () => null }));
const { default: WorkerView } = await import('./WorkerView');

// Semana ficticia del 22 al 27 de septiembre de 2026 (lunes 28, cola).
const semana = {
  meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Operativa Activa' },
  schedule: { martes: { title: 'Martes', tasks: [{ id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [{ id: 's1', text: 'Devolución', timeFrame: '10:00 - 11:00', targetDay: 'Lunes', assigned: ['Ana'] }] },
};
const equipo = [{ name: 'Ana', role: 'Conductora', avatar: '🚚', rate: 10 }];
const pintar = (clockEntries = []) => render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={semana} clockEntries={clockEntries} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);

describe('WorkerView', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('en turno: el cronómetro avanza solo, segundo a segundo', () => {
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getByText('TURNO ACTIVO EN CURSO')).toBeInTheDocument();
    expect(screen.getByText('1h 00m 00s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('1h 00m 03s')).toBeInTheDocument();
  });

  it('el trabajador ve lo que lleva ganado en su turno, subiendo en directo', () => {
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getByText('Llevas ganado en este turno')).toBeInTheDocument();
    expect(screen.getByText('≈ 10,00 €')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(36000); });
    expect(screen.getByText('≈ 10,10 €')).toBeInTheDocument();
  });

  it('en nómina fija no se enseña (no cobra por horas)', () => {
    render(<WorkerView workerName="Luis" workersList={[{ name: 'Luis', isPayroll: true, rate: 14 }]} activeWeekData={semana}
      clockEntries={[{ id: 'e2', workerName: 'Luis', type: 'entrada', timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    expect(screen.getByText('TURNO ACTIVO EN CURSO')).toBeInTheDocument();
    expect(screen.queryByText('Llevas ganado en este turno')).toBeNull();
  });

  it('los días van de martes a domingo y el lunes (cola) el último', () => {
    pintar();
    const chips = screen.getAllByRole('button').map(b => b.textContent).filter(t => /^(LUN|MAR|MIÉ|JUE|VIE|SÁB|DOM) \d/.test(t));
    expect(chips.map(t => t.slice(0, 3))).toEqual(['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', 'LUN']);
  });

  it('sin turno no enseña el cronómetro', () => {
    pintar();
    expect(screen.queryByText('TURNO ACTIVO EN CURSO')).toBeNull();
  });
});
