import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/render';
import DescargarExcel from './DescargarExcel';

describe('DescargarExcel (Resumen financiero)', () => {
  it('por defecto descarga todos los eventos del periodo; o solo el elegido', async () => {
    const onDescargar = vi.fn().mockResolvedValue();
    render(<DescargarExcel eventos={['Boda Uno', 'Boda Dos']} onDescargar={onDescargar} />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar Excel/ }));
    await waitFor(() => expect(onDescargar).toHaveBeenCalledWith(['Boda Uno', 'Boda Dos']));
    fireEvent.change(screen.getByLabelText('Evento para el Excel'), { target: { value: 'Boda Dos' } });
    fireEvent.click(screen.getByRole('button', { name: /Descargar Excel/ }));
    await waitFor(() => expect(onDescargar).toHaveBeenLastCalledWith(['Boda Dos']));
  });

  it('si falla, lo dice; sin eventos en el periodo, no sale', async () => {
    const { container } = render(<DescargarExcel eventos={['Boda Uno']} onDescargar={vi.fn().mockRejectedValue(new Error('sin memoria'))} />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar Excel/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el Excel: sin memoria');
    container.remove();
    render(<DescargarExcel eventos={[]} onDescargar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Descargar Excel/ })).toBeNull();
  });
});
