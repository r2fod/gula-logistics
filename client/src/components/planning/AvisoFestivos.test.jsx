import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../../test/render';
import AvisoFestivos from './AvisoFestivos';
import { usarFestivosLocales } from '../../data/festivos';

// Semana del 6 al 11 de octubre de 2026: el lunes 12 (cola) es festivo.
const semana = (tareas = [{ id: 'sl1', text: 'Devolver sillas', targetDay: 'Lunes', timeFrame: '09:30 - 10:30', assigned: ['Ana'] }]) => ({
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' }, schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: tareas },
});

afterEach(() => usarFestivosLocales([]));

describe('AvisoFestivos (Cuadrante)', () => {
  it('dice los festivos de la semana y qué recogidas o devoluciones hay ese día', () => {
    render(<AvisoFestivos semana={semana()} />);
    const aviso = screen.getByRole('region', { name: 'Festivos de la semana' });
    expect(aviso).toHaveTextContent('Viernes 9 · Día de la Comunitat Valenciana');
    expect(aviso).toHaveTextContent('Lunes 12 · Fiesta Nacional de España');
    expect(aviso).toHaveTextContent('«Devolver sillas»');
    // Quien solo mira (socias) no tiene el botón de mover.
    expect(screen.queryByRole('button', { name: /Pasar al/ })).toBeNull();
  });

  it('el admin la pasa con un toque al día que abren: pregunta antes y dice dónde ha quedado', async () => {
    const onPasar = vi.fn().mockResolvedValue({ destino: 'martes 13', semana: 'Semana 7' });
    render(<AvisoFestivos semana={semana()} onPasar={onPasar} />);
    fireEvent.click(screen.getByRole('button', { name: /Pasar al martes 13/ }));
    const pregunta = await screen.findByRole('dialog', { name: 'Pasar a un día que abren' });
    expect(pregunta).toHaveTextContent('«Devolver sillas» pasará al martes 13');
    expect(onPasar).not.toHaveBeenCalled();
    fireEvent.click(within(pregunta).getByRole('button', { name: 'Pasar al martes 13' }));
    await waitFor(() => expect(onPasar).toHaveBeenCalledWith('lunes', 0));
    expect(await screen.findByText(/Hecho: «Devolver sillas» está ahora el martes 13 \(Semana 7\)/)).toBeInTheDocument();
  });

  it('si no se puede (la semana siguiente no existe), enseña el motivo', async () => {
    const onPasar = vi.fn().mockResolvedValue({ error: 'No hay ninguna semana creada para el martes 13: créala primero («+ Semana») y vuelve a pulsarlo.' });
    render(<AvisoFestivos semana={semana()} onPasar={onPasar} />);
    fireEvent.click(screen.getByRole('button', { name: /Pasar al martes 13/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Pasar a un día que abren' })).getByRole('button', { name: 'Pasar al martes 13' }));
    expect(await screen.findByText(/No hay ninguna semana creada para el martes 13/)).toBeInTheDocument();
  });

  it('una semana sin festivos no pinta nada; un festivo sin recados solo lo menciona', () => {
    const { container, rerender } = render(<AvisoFestivos semana={{ ...semana(), meta: { dateRange: 'Del 13 al 18 de Octubre de 2026' } }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AvisoFestivos semana={semana([])} onPasar={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Festivos de la semana' })).not.toHaveTextContent('Cierran los proveedores');
  });
});
