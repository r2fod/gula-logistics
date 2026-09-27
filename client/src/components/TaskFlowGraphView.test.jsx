import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import TaskFlowGraphView from './TaskFlowGraphView';

const semana = () => ({
  id: 'week_t',
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' },
  trucks: [{ name: 'Camión Gula', tag: 'PROPIO' }],
  team: [],
  schedule: {
    martes: { title: 'Martes 15', tasks: [{ id: 'm1', text: 'Tarea de martes', timeFrame: '09:00-10:00', assigned: ['Ana'], completed: false }] },
  },
  saturdaySpecial: { title: 'Sábado 19', weddings: [{ location: 'Finca Sur', truck: 'Camión Gula', details: 'Boda', timeFrame: '12:00-16:00', assigned: ['Ana'] }] },
  sundayMonday: { title: 'Domingo 20 & Lunes 21', tasks: [{ id: 's1', text: 'Tarea de domingo', timeFrame: '10:00-11:00', targetDay: 'Domingo', assigned: ['Ana'], completed: false }] },
});

const cuentaHechas = (container) => container.querySelectorAll('.line-through').length;

describe('TaskFlowGraphView — tareas hechas', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('solo tacha lo que alguien marcó, también en una semana ya terminada (nada se da por hecho por la hora)', () => {
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0)); // martes siguiente: la semana 15-20 ya pasó entera
    const { container, unmount } = render(<TaskFlowGraphView activeWeekData={semana()} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(cuentaHechas(container)).toBe(0);
    unmount();

    const w = semana();
    w.sundayMonday.tasks[0].completed = true;
    const { container: conUna } = render(<TaskFlowGraphView activeWeekData={w} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(cuentaHechas(conUna)).toBeGreaterThanOrEqual(1);
  });

  it('una semana futura no tacha nada', () => {
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0));
    const { container } = render(<TaskFlowGraphView activeWeekData={semana()} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(cuentaHechas(container)).toBe(0);
  });
});

describe('TaskFlowGraphView — tareas desactivadas', () => {
  it('BUG evitado: una tarea desactivada no se dibuja en el grafo', () => {
    const w = semana();
    w.schedule.martes.tasks.push({ id: 'm2', text: 'Tarea apagada', timeFrame: '11:00-12:00', assigned: ['Ana'], active: false });
    const { container } = render(<TaskFlowGraphView activeWeekData={w} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(container.textContent).toContain('Tarea de martes');
    expect(container.textContent).not.toContain('Tarea apagada');
  });
});
