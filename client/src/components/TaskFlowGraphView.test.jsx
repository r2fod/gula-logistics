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

  it('BUG evitado: una semana ya terminada NO enseña como pendientes las bodas del sábado ni las tareas de domingo/lunes', () => {
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0)); // martes siguiente: la semana 15-20 ya pasó entera
    const { container } = render(<TaskFlowGraphView activeWeekData={semana()} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(cuentaHechas(container)).toBeGreaterThanOrEqual(3); // martes + boda + domingo tachadas
  });

  it('una semana futura no tacha nada', () => {
    vi.setSystemTime(new Date(2026, 8, 10, 12, 0));
    const { container } = render(<TaskFlowGraphView activeWeekData={semana()} workersList={[{ name: 'Ana', avatar: '🚚' }]} />);
    expect(cuentaHechas(container)).toBe(0);
  });
});
