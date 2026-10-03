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

  it('con alguien fichado ahora, las cifras suman lo que lleva su turno (y dicen cuánto es)', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const turnosAbiertos = { Eva: { workerName: 'Eva', type: 'entrada', isPayroll: false, rate: 10, timestamp: new Date(2026, 8, 21, 16, 0).toISOString() } };
    render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={{ week_3: semana3 }} activeWeekData={semana3} turnosAbiertos={turnosAbiertos} />);
    expect(within(tarjeta('Extras a pagar')).getByText('55,00 €')).toBeTruthy(); // 35 fichados + 2 h en curso
    expect(within(tarjeta('Extras a pagar')).getByText(/de turnos en curso/).textContent).toContain('20,00 €');
    expect(within(tarjeta('Coste de personal')).getByText('55,00 €')).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('5,5 h')).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText(/\+ 1 en curso/)).toBeTruthy();
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

const semana4 = {
  id: 'week_4', name: 'Semana 4',
  meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Operativa Activa' },
  events: [], schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
};

describe('FinancialSummaryTab — sigue a la semana elegida', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());
  const conSemanas = { week_3: semana3, week_4: semana4 };

  it('al cambiar de semana arriba, el resumen enseña los números de esa semana', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0));
    const { rerender } = render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={conSemanas} activeWeekData={semana3} />);
    expect(within(tarjeta('Horas registradas')).getByText('3,5 h')).toBeTruthy();
    rerender(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={conSemanas} activeWeekData={semana4} />);
    expect(screen.getByText(/Semana 4 · 22 sept – 28 sept 2026/)).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('0 h')).toBeTruthy();
    rerender(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={conSemanas} activeWeekData={semana3} />);
    expect(within(tarjeta('Horas registradas')).getByText('3,5 h')).toBeTruthy();
  });

  it('pulsar Semana vuelve a la semana elegida arriba aunque se haya ido a otra con las flechas', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0));
    render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={conSemanas} activeWeekData={semana3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Periodo siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Periodo siguiente' }));
    expect(screen.getByText(/29 sept – 5 oct 2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(screen.getByText(/Semana 3 · 15 sept – 21 sept 2026/)).toBeTruthy();
    expect(within(tarjeta('Horas registradas')).getByText('3,5 h')).toBeTruthy();
  });

  it('Mes y Año parten de la semana elegida, no de otra a la que se hubiera navegado', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
    render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={conSemanas} activeWeekData={semana3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Periodo siguiente' })); // semana del 22
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getByText(/Septiembre de 2026/)).toBeTruthy();
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

describe('FinancialSummaryTab — Saldos & Acuerdos y planning', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const pintar = (props = {}) => render(<FinancialSummaryTab shifts={shifts} workersList={[]} allWeeks={{ week_3: semana3 }} activeWeekData={semana3} {...props} />);
  const bolsa = { name: 'Ana Gula', isSpecialPurse: true, purseInfo: { totalHours: 80, consumedHours: 0, hourlyRate: 8, extraRateAfter80h: 12 } };

  it('BUG evitado: quien tiene bolsa de horas cuesta lo mismo que en Saldos (antes, a la tarifa del fichaje)', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    pintar({ saldos: [bolsa] });
    expect(within(tarjeta('Extras a pagar')).getByText('28,00 €')).toBeTruthy(); // 3,5 h a 8 €/h, no a 10
  });

  it('enseña lo apuntado a mano en Saldos del periodo y lo que suma con los extras fichados', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const saldos = [{ name: 'Eva', breakdown: [{ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 }, { concept: 'Rotura', amount: -5 }] }];
    pintar({ saldos });
    const seccion = screen.getByText('Apuntado a mano en Saldos & Acuerdos').closest('section') || screen.getByText('Apuntado a mano en Saldos & Acuerdos').parentElement.parentElement.parentElement;
    expect(within(seccion).getByText('Turnos apuntados a mano')).toBeTruthy();
    expect(within(seccion).getByText('70,00 €')).toBeTruthy(); // 35 fichados + 35 a mano
    expect(within(seccion).getByText(/1 concepto antiguo no lleva fecha/)).toBeTruthy(); // la rotura, solo en «Todo»
  });

  it('BUG evitado: un pago en efectivo no resta del coste; en «Todo» se ve lo pagado y lo que queda por pagar', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const saldos = [{ name: 'Eva', breakdown: [{ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35 }, { concept: 'Pago en efectivo', amount: -50 }] }];
    pintar({ saldos });
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    const pie = screen.getByText('Coste: extras fichados + a mano').closest('footer');
    expect(within(pie).getByText('90,00 €')).toBeTruthy(); // 55 fichados (todo el histórico) + 35 a mano; el pago no resta
    expect(within(pie).getByText('Ya pagado')).toBeTruthy();
    expect(within(pie).getByText('50,00 €')).toBeTruthy();
    expect(within(pie).getByText('40,00 €')).toBeTruthy(); // queda por pagar
  });

  it('BUG evitado: el desglose por evento cierra con el mismo total que «Coste por trabajador» (lo a mano va en su fila) y sale quien solo tiene un ajuste', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const saldos = [
      { name: 'Eva', breakdown: [{ concept: '🕒 16/09 (17:00 a 20:30 - 3.5h a 10€/h)', amount: 35, date: '2026-09-16', tipo: 'turno' }] },
      { name: 'Pau', breakdown: [{ concept: 'Rotura de copas', amount: -10, date: '2026-09-17', tipo: 'ajuste' }] },
    ];
    pintar({ saldos });
    const eventos = screen.getByText('Desglose por evento').closest('section');
    const personas = screen.getByText('Coste por trabajador').closest('section');
    const pieDe = (seccion) => seccion.querySelector('footer').textContent;
    expect(pieDe(eventos)).toBe(pieDe(personas));
    expect(within(eventos).getByText('✍️ Apuntado a mano (sin evento)')).toBeTruthy();
    expect(within(personas).getByText('Pau')).toBeTruthy(); // sin horas, pero con -10 € que sí suman en el total
  });

  it('en una semana, lo previsto por el planning frente a lo fichado', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    pintar();
    const fila = screen.getByRole('rowheader', { name: 'Ana' }).closest('tr');
    expect(within(fila).getAllByText('3,5 h')).toHaveLength(2); // previsto 20:00-23:30 y fichado 3,5 h
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.queryByText('Previsto según el planning')).toBeNull();
  });

  it('copia el resumen del periodo para WhatsApp', async () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    const escribir = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true });
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Copiar resumen para WhatsApp/ }));
    expect(escribir).toHaveBeenCalledWith(expect.stringContaining('📅 Semana 3 · 15 sept – 21 sept 2026'));
  });

  it('desde "Ver en Resumen" de Saldos: todo el histórico con esa persona abierta', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 18, 0));
    pintar({ enfoque: { persona: 'Ana Gula' } });
    expect(screen.getByText('Todo el histórico')).toBeTruthy();
    const abiertas = screen.getAllByRole('button', { expanded: true });
    expect(abiertas.map(b => b.textContent).join('|')).toMatch(/Ana/);
    expect(abiertas.some(b => /Luis/.test(b.textContent))).toBe(false);
  });
});
