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
