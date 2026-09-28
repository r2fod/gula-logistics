import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import FichaTrabajador from './FichaTrabajador';

describe('FichaTrabajador', () => {
  it('"a partir de las 15:00" todas las semanas: se añade y se guarda en su ficha', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'Conductor Extra' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '15:00' } }); // "hasta" vacío = a partir de las 15:00
    fireEvent.click(screen.getByRole('button', { name: /Añadir disponibilidad/ }));
    expect(screen.getByText('desde las 15:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ role: 'Conductor Extra', backup: false, nota: '', disponibilidad: [{ dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' }] }));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado.');
  });

  it('"cuando no está en cocina": solo si hace falta y con nota', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'Apoyo Logística & Prep' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Solo si hace falta/ }));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'cuando no está en cocina' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ backup: true, nota: 'cuando no está en cocina' })));
  });

  it('si no se guarda (sesión caducada), lo dice', async () => {
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'x' }} onGuardar={vi.fn().mockResolvedValue(false)} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
  });
});

describe('FichaTrabajador — grupos de días', () => {
  it('"de lunes a viernes, desde las 15:00" es una sola etiqueta y se guarda un apunte por día', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'Conductor Extra' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: 'entresemana' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir disponibilidad/ }));
    expect(screen.getByText('desde las 15:00 de lunes a viernes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    const { disponibilidad } = onGuardar.mock.calls[0][0];
    expect(disponibilidad.map(r => r.dia)).toEqual(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
    expect(disponibilidad.every(r => r.tipo === 'solo' && r.desde === '15:00' && r.hasta === '23:59')).toBe(true);
  });

  it('quitar la etiqueta quita todo el grupo', () => {
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'x', disponibilidad: dias.map(dia => ({ dia, tipo: 'solo', desde: '15:00', hasta: '23:59' })) }} onGuardar={vi.fn()} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar: desde las 15:00 de lunes a viernes' }));
    expect(screen.queryByText(/desde las 15:00/)).toBeNull();
  });
});
