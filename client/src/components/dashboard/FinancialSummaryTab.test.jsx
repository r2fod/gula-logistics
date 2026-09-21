import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FinancialSummaryTab from './FinancialSummaryTab';
import { pairShiftsFromEntries } from '../../data/shiftCalculations';

// Las gráficas no aportan nada aquí (y jsdom no mide su contenedor).
vi.mock('recharts', () => {
  const Nada = () => null;
  return { ResponsiveContainer: Nada, BarChart: Nada, Bar: Nada, XAxis: Nada, YAxis: Nada, Tooltip: Nada, Cell: Nada, PieChart: Nada, Pie: Nada };
});

// Semana ficticia del 15 al 20 de septiembre de 2026 (cola: lunes 21).
const semana3 = {
  id: 'week_3', name: 'Semana 3',
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Operativa Activa' },
  events: [{ name: 'Boda Uno', pax: 100 }],
  schedule: {},
  saturdaySpecial: { weddings: [{ location: 'Finca Norte', truck: 'Camión A', timeFrame: '20:00-23:30', assigned: ['Ana'], event: 'Boda Uno' }] },
  sundayMonday: { tasks: [] },
};

let n = 0;
const turnos = (...tramos) => pairShiftsFromEntries(tramos.flatMap(([workerName, ini, fin, taskName]) => (
  ['entrada', 'salida'].map((type, i) => ({ workerName, role: 'x', isPayroll: false, rate: 10, type, id: `e${++n}`, timestamp: (i ? fin : ini).toISOString(), taskName }))
))).shifts;

const shifts = turnos(
  ['Ana', new Date(2026, 8, 19, 20, 0), new Date(2026, 8, 19, 23, 30), 'Inicio de Jornada'], // semana 3, sin tarea: 3,5 h
  ['Luis', new Date(2026, 8, 29, 9, 0), new Date(2026, 8, 29, 11, 0), 'Boda Uno - Cargar'], // 2 h, semana del 29/09
);

const renderTab = () => render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={{ week_3: semana3 }} activeWeekData={semana3} />);
const tarjeta = (titulo) => screen.getByText(titulo).closest('div.bg-slate-900');

describe('FinancialSummaryTab — periodo', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('abre en la semana del planning que está abierto y suma solo sus turnos', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    expect(screen.getByText(/Semana 3 · 15 sept – 21 sept 2026/)).toBeTruthy();
    expect(within(tarjeta('Horas Registradas')).getByText('3.5 h')).toBeTruthy();
    expect(within(tarjeta('Presupuesto Extras a Pagar')).getByText('35.00 €')).toBeTruthy();
  });

  it('Mes y Año suman también las otras semanas; Todo, todo el histórico', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(within(tarjeta('Horas Registradas')).getByText('5.5 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Año' }));
    expect(within(tarjeta('Horas Registradas')).getByText('5.5 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByText('Todo el histórico')).toBeTruthy();
    expect(within(tarjeta('Horas Registradas')).getByText('5.5 h')).toBeTruthy();
  });

  it('se puede ir a la semana anterior y sin fichajes lo dice, y volver', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Periodo anterior' }));
    expect(screen.getByText(/8 sept – 14 sept 2026/)).toBeTruthy();
    expect(screen.getByText('No hay fichajes en este periodo.')).toBeTruthy();
    expect(within(tarjeta('Horas Registradas')).getByText('0 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Periodo siguiente' }));
    expect(within(tarjeta('Horas Registradas')).getByText('3.5 h')).toBeTruthy();
  });

  it('no deja avanzar a un periodo que aún no ha empezado', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0)); // el martes 22 aún no ha llegado
    renderTab();
    expect(screen.getByRole('button', { name: 'Periodo siguiente' }).disabled).toBe(true);
  });

  it('avisa de las horas de jornada sin tarea repartidas según el planning, sin cambiar los totales', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    expect(screen.getByText(/jornadas fichadas sin tarea concreta/)).toBeTruthy();
    const fila = screen.getByText('Boda Uno').closest('tr');
    expect(within(fila).getByText('3.5 h')).toBeTruthy();
    expect(within(fila).getByText('35.00 €')).toBeTruthy();
    expect(screen.queryByText('Tareas Internas')).toBeNull(); // ya no cae en el cajón general
  });
});
