import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import Festivos from './Festivos';
import { usarFestivosLocales, festivoEn } from '../../data/festivos';
import { guardarAjustesAdmin } from '../../data/apiService';

vi.mock('../../data/apiService', () => ({ fetchAjustesAdmin: vi.fn(), guardarAjustesAdmin: vi.fn() }));

const HOY = new Date(2026, 9, 5); // 5 de octubre de 2026

describe('Festivos (Configuración)', () => {
  beforeEach(() => { usarFestivosLocales([]); guardarAjustesAdmin.mockReset(); });
  afterEach(() => usarFestivosLocales([]));

  it('enseña los próximos festivos que ya se tienen en cuenta', () => {
    render(<Festivos hoy={HOY} />);
    expect(screen.getByText(/Día de la Comunitat Valenciana/)).toBeInTheDocument();
    expect(screen.getByText(/Fiesta Nacional de España/)).toBeInTheDocument();
    expect(screen.getByText(/Inmaculada Concepción/)).toBeInTheDocument();
  });

  it('añadir un festivo local lo guarda en el servidor y desde ese momento cuenta; quitarlo, igual', async () => {
    guardarAjustesAdmin.mockImplementation(async ({ festivos }) => ({ festivos }));
    render(<Festivos hoy={HOY} />);
    fireEvent.change(screen.getByLabelText('Día del festivo'), { target: { value: '2026-10-14' } });
    fireEvent.change(screen.getByLabelText('Nombre del festivo'), { target: { value: 'Fiesta del pueblo' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir/ }));
    await waitFor(() => expect(guardarAjustesAdmin).toHaveBeenCalledWith({ festivos: [{ fecha: '2026-10-14', nombre: 'Fiesta del pueblo' }] }));
    expect(await screen.findByRole('status')).toHaveTextContent('Festivo añadido.');
    expect(festivoEn('2026-10-14')).toMatchObject({ nombre: 'Fiesta del pueblo', local: true });

    fireEvent.click(screen.getByRole('button', { name: /Quitar el festivo/ }));
    await waitFor(() => expect(guardarAjustesAdmin).toHaveBeenLastCalledWith({ festivos: [] }));
    await waitFor(() => expect(festivoEn('2026-10-14')).toBeNull());
  });

  it('no deja repetir un día que ya es festivo, y si el servidor no guarda lo dice', async () => {
    render(<Festivos hoy={HOY} />);
    fireEvent.change(screen.getByLabelText('Día del festivo'), { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese día ya es festivo (Fiesta Nacional de España).');
    expect(guardarAjustesAdmin).not.toHaveBeenCalled();

    guardarAjustesAdmin.mockResolvedValue(null);
    fireEvent.change(screen.getByLabelText('Día del festivo'), { target: { value: '2026-10-14' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar'));
    expect(festivoEn('2026-10-14')).toBeNull();
  });
});
