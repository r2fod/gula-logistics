import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TareaDiaItem from './TareaDiaItem';
import ScheduleTab from './ScheduleTab';

const tarea = { text: 'Evento Uno - Carga camión', timeFrame: '17:00-17:30', assigned: ['Ana'] };

describe('TareaDiaItem', () => {
  it('pulsable: al pulsarla avisa; sin alPulsar es solo lectura', () => {
    const alPulsar = vi.fn();
    const { rerender, container } = render(<ul><TareaDiaItem task={tarea} hecha={false} alPulsar={alPulsar} /></ul>);
    fireEvent.click(screen.getByText(/Carga camión/));
    expect(alPulsar).toHaveBeenCalledTimes(1);
    expect(container.querySelector('li').className).toContain('cursor-pointer');
    rerender(<ul><TareaDiaItem task={tarea} hecha={false} /></ul>);
    expect(container.querySelector('li').className).not.toContain('cursor-pointer');
  });

  it('hecha se tacha y lleva el check; el filtro resalta las de esa persona y apaga las demás', () => {
    const { container, rerender } = render(<ul><TareaDiaItem task={tarea} hecha /></ul>);
    expect(container.querySelector('li').className).toContain('line-through');
    rerender(<ul><TareaDiaItem task={tarea} hecha={false} filtro="Ana" /></ul>);
    expect(container.querySelector('li').className).toContain('ring-amber-500/40');
    rerender(<ul><TareaDiaItem task={tarea} hecha={false} filtro="Luis" /></ul>);
    expect(container.querySelector('li').className).toContain('opacity-30');
  });

  it('BUG evitado: el lunes de la víspera marca las tareas igual que los demás días', () => {
    const semana = { id: 's', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' }, schedule: { martes: { title: 'Martes 15', badge: 'x', tasks: [{ ...tarea, completed: true }] } }, saturdaySpecial: { weddings: [] } };
    const previa = { name: 'Semana anterior', meta: { dateRange: 'Del 8 al 13 de Septiembre de 2026' } };
    const { container } = render(<ScheduleTab activeWeekData={semana} workersList={[]} onToggleTask={() => {}} onUpdateWeek={() => {}} vispera={{ fecha: new Date(2026, 8, 14), semana: previa, tareas: [{ task: { ...tarea, completed: true }, idx: 0 }] }} />);
    const filas = [...container.querySelectorAll('li')].filter(li => /Carga camión/.test(li.textContent));
    expect(filas).toHaveLength(2); // la de la víspera y la del martes
    const sinPulsar = (li) => li.className.replace('cursor-pointer', '').replace(/\s+/g, ' ').trim();
    expect(sinPulsar(filas[0])).toBe(sinPulsar(filas[1])); // mismas clases: mismo aspecto
  });
});
