import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '../test/render';

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
    expect(screen.getAllByText('EN TURNO')[0]).toBeInTheDocument();
    expect(screen.getByText('1h 00m 00s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('1h 00m 03s')).toBeInTheDocument();
  });

  it('el trabajador ve lo que lleva ganado en su turno, subiendo en directo', () => {
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getByText('Llevas ganado')).toBeInTheDocument();
    expect(screen.getByText('≈ 10,00 €')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(36000); });
    expect(screen.getByText('≈ 10,10 €')).toBeInTheDocument();
  });

  it('en nómina fija no se enseña (no cobra por horas)', () => {
    render(<WorkerView workerName="Luis" workersList={[{ name: 'Luis', isPayroll: true, rate: 14 }]} activeWeekData={semana}
      clockEntries={[{ id: 'e2', workerName: 'Luis', type: 'entrada', timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    expect(screen.getAllByText('EN TURNO')[0]).toBeInTheDocument();
    expect(screen.queryByText('Llevas ganado')).toBeNull();
  });

  it('BUG evitado: las horas de la semana y del mes suman sus turnos cerrados (antes salía siempre 0 h) y cada salida dice cuánto duró', () => {
    const t = (d, h, m) => new Date(2026, 8, d, h, m).toISOString();
    const fichajes = [
      { id: 'a1', workerName: 'Ana', type: 'entrada', timestamp: t(22, 9, 0), taskName: 'JORNADA' },
      { id: 'a2', workerName: 'Ana', type: 'salida', timestamp: t(22, 12, 15) }, // 3 h 15 min → 3,5 h
      { id: 'a3', workerName: 'Ana', type: 'entrada', timestamp: t(23, 8, 0), taskName: 'JORNADA' },
      { id: 'a4', workerName: 'Ana', type: 'salida', timestamp: t(23, 9, 0) },
    ];
    render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={semana} clockEntries={fichajes} fichajesDeTodo={[
      ...fichajes,
      { id: 'b1', workerName: 'Ana', type: 'entrada', timestamp: t(8, 9, 0), taskName: 'JORNADA' }, // semana anterior, mismo mes
      { id: 'b2', workerName: 'Ana', type: 'salida', timestamp: t(8, 11, 0) },
    ]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    const resumen = screen.getByRole('region', { name: 'Tus horas y tu saldo' });
    expect(resumen.textContent).toMatch(/4,5\s?hsemana/);
    expect(resumen.textContent).toMatch(/6,5\s?hseptiembre/);
    fireEvent.click(screen.getByRole('button', { name: /Fichajes/ }));
    expect(screen.getByText(/Duración: 3,5\s?h/)).toBeInTheDocument();
    expect(screen.getByText(/Duración: 1\s?h/)).toBeInTheDocument();
  });

  it('los días van de martes a domingo y el lunes (cola) el último', () => {
    pintar();
    const chips = screen.getAllByRole('button').map(b => b.textContent).filter(t => /^(LUN|MAR|MIÉ|JUE|VIE|SÁB|DOM) \d/.test(t));
    expect(chips.map(t => t.slice(0, 3))).toEqual(['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', 'LUN']);
  });

  it('sin turno no enseña el cronómetro', () => {
    pintar();
    expect(screen.queryByText('Llevas ganado')).toBeNull();
    expect(screen.queryByText(/^\d+h \d\dm \d\ds$/)).toBeNull();
    expect(screen.queryByText('Fichar salida')).toBeNull();
  });
});

describe('WorkerView — botón de fichar la entrada', () => {
  afterEach(() => vi.useRealTimers());
  const botonEntrada = () => screen.getAllByRole('button').find(b => /INICIAR JORNADA|para fichar|Sin tareas pendientes/.test(b.textContent));
  const a = (dia, h, m = 0) => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, dia, h, m, 0)); };

  it('antes de 5 min de la primera tarea está bloqueado y dice desde cuándo', () => {
    a(28, 9, 0); // la del lunes empieza a las 10:00
    pintar();
    expect(botonEntrada()).toBeDisabled();
    expect(botonEntrada()).toHaveTextContent('Espera 55 min para fichar');
    expect(screen.getByText(/Podrás fichar a partir de las 09:55 \(5 min antes de tu primera tarea\)/)).toBeInTheDocument();
  });

  it('a 5 min de la primera tarea se activa', () => {
    a(28, 9, 56);
    pintar();
    expect(botonEntrada()).toBeEnabled();
    expect(botonEntrada()).toHaveTextContent(/INICIAR JORNADA/);
  });

  it('BUG evitado: con solo tareas ya pasadas sin marcar no queda activo (antes lo estaba siempre)', () => {
    a(28, 12, 0); // la del martes y la del lunes ya terminaron y nadie las marcó
    pintar();
    expect(botonEntrada()).toBeDisabled();
    expect(botonEntrada()).toHaveTextContent('Sin tareas pendientes');
    expect(screen.getByText(/usa «O fichar otra tarea libre»/)).toBeInTheDocument();
  });

  it('con las fechas de la semana ilegibles no deja a nadie sin poder fichar', () => {
    a(28, 12, 0);
    render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={{ ...semana, meta: { dateRange: 'por decidir' } }} clockEntries={[]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    expect(botonEntrada()).toBeEnabled();
  });
});
