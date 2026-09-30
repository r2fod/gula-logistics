import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../test/render';
import LiveMonitorPanel from './LiveMonitorPanel';

const equipo = [{ name: 'Ana', role: 'Conductora', avatar: '🚚', rate: 10 }, { name: 'Luis', role: 'Base', avatar: '👤', isPayroll: true, rate: 14 }];
const entrada = (workerName, h, m = 0, extra = {}) => ({ id: `e-${workerName}`, workerName, type: 'entrada', timestamp: new Date(2026, 8, 28, h, m).toISOString(), taskName: 'JORNADA', ...extra });

describe('LiveMonitorPanel — dinero en tiempo real', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('lo que lleva ganado cada persona en turno sube con el tiempo, a su tarifa', () => {
    render(<LiveMonitorPanel workersList={equipo} clockEntries={[entrada('Ana', 9, 0)]} mostrarDinero />);
    expect(screen.getByText('Lleva ganado')).toBeInTheDocument();
    expect(screen.getByText('10,00 €')).toBeInTheDocument(); // 1 h a 10 €/h
    act(() => { vi.advanceTimersByTime(36000); }); // +36 s = +0,10 €
    expect(screen.getByText('10,10 €')).toBeInTheDocument();
    expect(screen.getByText('1h 00m 36s')).toBeInTheDocument();
  });

  it('con bolsa de horas cobra como en Saldos', () => {
    const saldos = [{ name: 'Ana Gula', isSpecialPurse: true, purseInfo: { totalHours: 80, consumedHours: 0, hourlyRate: 8, extraRateAfter80h: 12 } }];
    render(<LiveMonitorPanel workersList={equipo} clockEntries={[entrada('Ana', 9, 0)]} mostrarDinero saldos={saldos} />);
    expect(screen.getByText('8,00 €')).toBeInTheDocument();
  });

  it('la nómina fija sale como valoración y la tarifa se lee del dato (no fija en el código)', () => {
    render(<LiveMonitorPanel workersList={equipo} clockEntries={[entrada('Luis', 9, 30)]} mostrarDinero />);
    expect(screen.getByText('Valoración en curso')).toBeInTheDocument();
    expect(screen.getByText('7,00 €')).toBeInTheDocument();
    expect(screen.getByText('Nómina (14,00 €/h)')).toBeInTheDocument();
  });

  it('BUG evitado: en la vista pública (sin mostrarDinero) no se ve dinero', () => {
    render(<LiveMonitorPanel workersList={equipo} clockEntries={[entrada('Ana', 9, 0)]} />);
    expect(screen.queryByText('Lleva ganado')).toBeNull();
    expect(screen.queryByText('10,00 €')).toBeNull();
    expect(screen.queryByText(/€\/h/)).toBeNull(); // tampoco la tarifa de cada persona
  });
});

describe('LiveMonitorPanel — tareas desactivadas', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 22, 10, 0, 0)); }); // martes
  afterEach(() => vi.useRealTimers());

  it('BUG evitado: la tarea de hoy que está desactivada no sale como tarea asignada', () => {
    const semana = { meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' }, schedule: { martes: { tasks: [
      { text: 'Tarea apagada', timeFrame: '09:00 - 12:00', assigned: ['Ana'], active: false },
      { text: 'Tarea buena', timeFrame: '09:00 - 12:00', assigned: ['Ana'] },
    ] } } };
    render(<LiveMonitorPanel workersList={equipo} clockEntries={[entrada('Ana', 9, 0).timestamp && { ...entrada('Ana', 9, 0), timestamp: new Date(2026, 8, 22, 9, 0).toISOString() }]} activeWeekData={semana} />);
    expect(document.body.textContent).toContain('Tarea buena');
    expect(document.body.textContent).not.toContain('Tarea apagada');
  });

  it('BUG evitado: las tareas de HOY salen por su fecha real, de la semana que sea (antes, el día con ese nombre de la semana abierta)', () => {
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0)); // lunes 28: cola de la semana del 22
    const anterior = { meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' }, schedule: {}, sundayMonday: { tasks: [
      { text: 'Devolución de hoy', timeFrame: '09:00 - 12:00', targetDay: 'Lunes', assigned: ['Ana'] },
    ] } };
    const abierta = { meta: { dateRange: 'Del 29 de Septiembre al 4 de Octubre de 2026' }, schedule: {}, sundayMonday: { tasks: [
      { text: 'Carga del lunes que viene', timeFrame: '09:00 - 12:00', targetDay: 'Lunes', assigned: ['Ana'] },
    ] } };
    const enTurno = [{ ...entrada('Ana', 9, 0), timestamp: new Date(2026, 8, 28, 9, 0).toISOString() }];
    render(<LiveMonitorPanel workersList={equipo} clockEntries={enTurno} activeWeekData={abierta} semanas={{ anterior, abierta }} />);
    expect(document.body.textContent).toContain('Devolución de hoy');
    expect(document.body.textContent).not.toContain('Carga del lunes que viene');
  });
});
