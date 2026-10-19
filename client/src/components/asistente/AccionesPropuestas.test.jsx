import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import AccionesPropuestas from './AccionesPropuestas';

const acciones = [
  { tipo: 'tarifa', ok: true, texto: 'Tarifa de Ana: 10,00 €/h → 12,00 €/h' },
  { tipo: 'apunte', ok: true, texto: 'Saldos de Luis: +8,00 € «Transporte» · 19 oct', aviso: '' },
  { tipo: 'festivo', ok: false, texto: 'Festivo local: martes, 8 de diciembre', error: 'Ya es festivo: Inmaculada Concepción.' },
];

describe('AccionesPropuestas (lo que el asistente cambiaría en la app)', () => {
  it('nada se aplica sin pulsar; se puede quitar una; las que no se pueden, con su motivo y sin casilla', async () => {
    const onAplicar = vi.fn().mockResolvedValue([{ ok: true, error: '' }]);
    render(<AccionesPropuestas acciones={acciones} onAplicar={onAplicar} />);
    expect(onAplicar).not.toHaveBeenCalled();
    expect(screen.getByText('No se puede: Ya es festivo: Inmaculada Concepción.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Festivo local/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Saldos de Luis/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar este cambio' }));
    await waitFor(() => expect(onAplicar).toHaveBeenCalledWith([acciones[0]]));
    expect(await screen.findByText('Hecho.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull(); // no se aplica dos veces
  });

  it('si una falla, lo dice en su tarjeta', async () => {
    render(<AccionesPropuestas acciones={acciones.slice(0, 2)} onAplicar={vi.fn().mockResolvedValue([{ ok: true }, { ok: false, error: 'No se pudo guardar en Saldos.' }])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar estos 2 cambios' }));
    expect(await screen.findByText('No se pudo guardar en Saldos.')).toBeInTheDocument();
  });

  it('sin sesión de administrador solo se enseñan', () => {
    render(<AccionesPropuestas acciones={acciones} onAplicar={null} />);
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull();
    expect(screen.getByText(/hace falta la sesión de administrador/)).toBeInTheDocument();
  });
});
