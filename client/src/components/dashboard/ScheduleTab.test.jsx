import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleTab from './ScheduleTab';

// Semana real de producción: martes 15 -> domingo 20, con el lunes 21 de cola.
const semana = (tasks) => ({
  id: 'week_test',
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' },
  trucks: [],
  schedule: {},
  saturdaySpecial: { weddings: [] },
  sundayMonday: { title: 'Domingo 20 & Lunes 21 — Logística Inversa y Limpieza', tasks },
});

const tareas = [
  { text: 'Recogida en finca', timeFrame: '15:00-17:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false },
  { text: 'Devolución camión', timeFrame: '13:00-13:30', targetDay: 'Lunes', assigned: ['Ana'], completed: false },
  { text: 'Tarea sin día', timeFrame: '09:00-10:00', assigned: ['Ana'], completed: false },
];

const renderTab = (week) => render(<ScheduleTab activeWeekData={week} workersList={[]} onToggleTask={() => {}} onUpdateWeek={() => {}} />);
const cardOf = (text) => screen.getByText(text).closest('.rounded-2xl');

describe('ScheduleTab — bloque domingo/lunes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('separa las tareas por "Día Específico" y aparte las que no tienen día', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
    renderTab(semana(tareas));

    expect(screen.getByText('Domingo 20')).toBeInTheDocument();
    expect(screen.getByText('Lunes 21')).toBeInTheDocument();
    expect(screen.getByText('Sin día fijado (domingo o lunes)')).toBeInTheDocument();
  });

  it('BUG evitado: el domingo por la noche solo se tacha la de domingo cuya hora ya pasó', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 20, 39));
    renderTab(semana(tareas));

    expect(cardOf('Recogida en finca').className).toContain('line-through');
    expect(cardOf('Devolución camión').className).not.toContain('line-through'); // es del lunes
    expect(cardOf('Tarea sin día').className).not.toContain('line-through'); // ambigua -> no se da por hecha
  });

  it('el lunes a las 13:10 la devolución de 13:00-13:30 sigue viva y la sin día de 09:00-10:00 ya pasó', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 13, 10));
    renderTab(semana(tareas));

    expect(cardOf('Devolución camión').className).not.toContain('line-through');
    expect(cardOf('Tarea sin día').className).toContain('line-through');
  });

  it('una semana futura no tacha nada aunque hoy sea domingo por la noche', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 20, 39));
    const futura = { ...semana(tareas), meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' } };
    renderTab(futura);

    for (const t of tareas) expect(cardOf(t.text).className).not.toContain('line-through');
  });

  it('sin tareas etiquetadas no se pintan grupos vacíos', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
    renderTab(semana([tareas[2]]));

    expect(screen.queryByText('Domingo 20')).not.toBeInTheDocument();
    expect(screen.queryByText('Lunes 21')).not.toBeInTheDocument();
  });
});

describe('ScheduleTab — evento de cada tarea', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('una tarea "Evento - Tarea" muestra el evento como etiqueta y la tarea aparte; sin evento se ve tal cual', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
    const week = semana([
      { text: 'Boda Ana y Luis - Descarga + Montaje Estructura', timeFrame: '09:00-11:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false },
      { text: 'Recoger material sin evento', timeFrame: '12:00-13:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false },
    ]);
    renderTab(week);

    expect(screen.getByText('Boda Ana y Luis')).toBeInTheDocument(); // etiqueta del evento
    expect(screen.getByText(/Descarga \+ Montaje Estructura/)).toBeInTheDocument();
    expect(screen.queryByText(/Boda Ana y Luis - Descarga/)).not.toBeInTheDocument(); // el " - " ya no se ve en bruto
    expect(screen.getByText('Recoger material sin evento')).toBeInTheDocument();
  });
});

describe('ScheduleTab — tarea de varios eventos', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('muestra una etiqueta por evento', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
    renderTab(semana([{ text: 'Boda Ana y Luis + Boda Eva y Pau - Recoger material Dealde', timeFrame: '09:00-10:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false }]));
    expect(screen.getByText('Boda Ana y Luis')).toBeInTheDocument();
    expect(screen.getByText('Boda Eva y Pau')).toBeInTheDocument();
    expect(screen.getByText(/Recoger material Dealde/)).toBeInTheDocument();
  });
});
