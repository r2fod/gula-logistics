import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import AsignarNuevas from './AsignarNuevas';

const semana = (tareas) => ({
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' },
  schedule: { martes: { tasks: [] }, miercoles: { tasks: tareas }, jueves: { tasks: [] }, viernes: { tasks: [] } },
  saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
});
const equipo = [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }];
const vieja = { id: 'mi1', text: 'Carga', timeFrame: '08:00 - 09:00', assigned: ['Luis'] };
const nueva = { id: 'mi2', text: 'Recoger generador 7k', timeFrame: '10:00 - 10:30', assigned: ['Eva'] };
const sugerencias = [{ item: { texto: 'recoger generador 7k', verbo: 'recoger', claves: ['generador', '7k'] }, suelen: { lista: [{ nombre: 'Ana', veces: 3 }], fuente: 'planning' } }];

describe('AsignarNuevas', () => {
  it('pregunta quién va a cada tarea nueva, con quien la suele hacer primero, y cambia solo esa', () => {
    const onCambiar = vi.fn();
    render(<AsignarNuevas original={semana([vieja])} propuesta={semana([vieja, nueva])} equipo={equipo} sugerencias={sugerencias} onCambiar={onCambiar} />);
    expect(screen.getByText(/¿Quién va\?/)).toBeTruthy();
    expect(screen.getByText('Suele hacerla: Ana (3 veces).')).toBeTruthy();
    const grupo = screen.getByRole('group', { name: /Recoger generador 7k/ });
    const chips = [...grupo.querySelectorAll('button')].map(b => b.textContent);
    expect(chips[0]).toMatch(/^Ana/); // la sugerida, la primera
    expect(screen.getByRole('button', { name: /Eva/ }).getAttribute('aria-pressed')).toBe('true'); // la que puso Gemini
    fireEvent.click(screen.getByRole('button', { name: /^Ana/ }));
    const cambiada = onCambiar.mock.calls[0][0];
    expect(cambiada.schedule.miercoles.tasks[1].assigned).toEqual(['Eva', 'Ana']);
    expect(cambiada.schedule.miercoles.tasks[0].assigned).toEqual(['Luis']); // la vieja, igual
  });

  it('sin tareas nuevas no enseña nada', () => {
    const { container } = render(<AsignarNuevas original={semana([vieja])} propuesta={semana([vieja])} equipo={equipo} onCambiar={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
