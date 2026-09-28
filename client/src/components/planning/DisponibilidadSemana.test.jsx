import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import DisponibilidadSemana from './DisponibilidadSemana';

const equipo = [{ name: 'Ana', role: 'Conductora' }, { name: 'Luis', role: 'Conductor' }];
const semana = {
  meta: { dateRange: 'Del 20 al 25 de Octubre de 2026', status: 'Borrador' },
  schedule: { jueves: { tasks: [{ id: 'j1', text: 'Boda X - Recogida y vuelta a base', timeFrame: '09:00 - 11:00', assigned: ['Ana'] }] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [] },
};

describe('DisponibilidadSemana', () => {
  afterEach(() => vi.useRealTimers());

  it('"Ana no puede el jueves": se guarda y propone cambiarla por quien sí puede; Aplicar guarda el planning', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1));
    const onGuardar = vi.fn();
    render(<DisponibilidadSemana semana={semana} equipo={equipo} esBorrador onGuardar={onGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: /Disponibilidad/ }));
    fireEvent.change(screen.getByLabelText('Indicación sobre el equipo'), { target: { value: 'Ana no puede el jueves' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Añadir/ })[0]);

    expect(onGuardar).toHaveBeenCalledWith({ meta: expect.objectContaining({ disponibilidad: [expect.objectContaining({ persona: 'Ana', dia: 'jueves', tipo: 'no' })] }) });
    expect(screen.getByText(/entra Luis/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    const guardado = onGuardar.mock.calls.at(-1)[0];
    expect(guardado.schedule.jueves.tasks[0].assigned).toEqual(['Luis']);
    expect(guardado.meta.disponibilidad).toHaveLength(1);
  });

  it('lo que no entiende lo dice, sin guardar nada', () => {
    const onGuardar = vi.fn();
    render(<DisponibilidadSemana semana={semana} equipo={equipo} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Indicación sobre el equipo'), { target: { value: 'haz algo raro' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Añadir/ })[0]);
    expect(screen.getByRole('alert')).toHaveTextContent('No lo he entendido');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('cambiar el máximo de horas al día se guarda en la semana', () => {
    const onGuardar = vi.fn();
    render(<DisponibilidadSemana semana={semana} equipo={equipo} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText('Máximo al día'), { target: { value: '10' } });
    expect(onGuardar).toHaveBeenCalledWith({ meta: expect.objectContaining({ limites: { maxHorasDia: 10, descansoMinHoras: 12 } }) });
  });
});
