import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FinancialSummaryTab from './FinancialSummaryTab';
import { pairShiftsFromEntries } from '../../data/shiftCalculations';

// Las gráficas no aportan nada aquí (y jsdom no mide su contenedor).
vi.mock('recharts', () => {
  const Nada = () => null;
  return { ResponsiveContainer: Nada, BarChart: Nada, Bar: Nada, XAxis: Nada, YAxis: Nada, CartesianGrid: Nada, Tooltip: Nada, Cell: Nada, PieChart: Nada, Pie: Nada };
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

const renderTab = (turnosPasados = shifts) => render(<FinancialSummaryTab shifts={turnosPasados} workersList={[]} allWeeks={{ week_3: semana3 }} activeWeekData={semana3} />);
const tarjeta = (titulo) => screen.getByText(titulo).closest('div.bg-slate-900');

describe('FinancialSummaryTab — periodo', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('abre en la semana del planning que está abierto y suma solo sus turnos', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    expect(screen.getByText(/Semana 3 · 15 sept – 21 sept 2026/)).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('3,5 h')).toBeTruthy();
    expect(within(tarjeta('Extras a pagar')).getByText('35,00 €')).toBeTruthy();
    expect(within(tarjeta('Coste de personal')).getByText('35,00 €')).toBeTruthy();
  });

  it('Mes y Año suman también las otras semanas; Todo, todo el histórico', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(within(tarjeta('Horas registradas')).getByText('5,5 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Año' }));
    expect(within(tarjeta('Horas registradas')).getByText('5,5 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByText('Todo el histórico')).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('5,5 h')).toBeTruthy();
  });

  it('se puede ir a la semana anterior y sin fichajes lo dice, y volver', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Periodo anterior' }));
    expect(screen.getByText(/8 sept – 14 sept 2026/)).toBeTruthy();
    expect(screen.getByText('No hay fichajes en este periodo.')).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('0 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Periodo siguiente' }));
    expect(within(tarjeta('Horas registradas')).getByText('3,5 h')).toBeTruthy();
  });

  it('un periodo vacío ofrece ir al último con fichajes', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Periodo anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir al último periodo con fichajes' }));
    expect(screen.getByText(/29 sept – 5 oct 2026/)).toBeTruthy(); // la semana del último turno
    expect(within(tarjeta('Horas registradas')).getByText('2 h')).toBeTruthy();
  });

  it('no deja avanzar a un periodo que aún no ha empezado', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0)); // el martes 22 aún no ha llegado
    renderTab();
    expect(screen.getByRole('button', { name: 'Periodo siguiente' }).disabled).toBe(true);
  });
});

describe('FinancialSummaryTab — desglose y comparación', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('avisa de las horas de jornada sin tarea repartidas según el planning, sin cambiar los totales', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    expect(screen.getByText(/jornadas fichadas sin tarea concreta/)).toBeTruthy();
    const fila = screen.getByRole('button', { name: /Boda Uno/ }).closest('li');
    expect(within(fila).getAllByText('3,5 h').length).toBeGreaterThan(0);
    expect(within(fila).getAllByText('35,00 €').length).toBeGreaterThan(0);
    expect(within(fila).getByText('100 pax')).toBeTruthy();
    expect(screen.queryByText('Tareas Internas')).toBeNull(); // ya no cae en el cajón general
  });

  it('una fila se despliega y enseña quién trabajó en el evento', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    const boton = screen.getByRole('button', { name: /Boda Uno/ });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(within(boton.closest('li')).getByText('Ana')).toBeTruthy();
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('false');
  });

  it('el detalle de una persona lista los eventos en los que trabajó', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    const persona = screen.getAllByRole('button', { name: /Ana/ })[0];
    fireEvent.click(persona);
    expect(within(persona.closest('li')).getByText('Boda Uno')).toBeTruthy();
  });

  it('compara con el periodo anterior: cuánto sube o baja el coste', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const conAnterior = [...shifts, ...turnos(['Luis', new Date(2026, 8, 10, 9, 0), new Date(2026, 8, 10, 10, 0), 'Inicio de Jornada'])]; // 10 € la semana anterior
    renderTab(conAnterior);
    expect(within(tarjeta('Coste de personal')).getByText('+250,0 %')).toBeTruthy();
    expect(within(tarjeta('Coste de personal')).getByText(/vs semana anterior/)).toBeTruthy();
  });

  it('sin datos del periodo anterior no inventa una comparación', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    renderTab();
    expect(within(tarjeta('Coste de personal')).getByText(/Sin datos de la semana anterior/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(within(tarjeta('Coste de personal')).getByText(/Extras \+ valoración de nómina/)).toBeTruthy();
  });
});
