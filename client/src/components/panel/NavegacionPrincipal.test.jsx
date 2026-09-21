import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarraPestanas, BarraInferior } from './NavegacionPrincipal';

describe('BarraPestanas', () => {
  it('muestra todas las secciones, marca la activa y avisa al pulsar otra', () => {
    const alSeleccionar = vi.fn();
    render(<BarraPestanas activa="schedule" onSeleccionar={alSeleccionar} contadorFichajes={103} />);
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByRole('tab', { name: /Cuadrante semanal/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Resumen financiero/ }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: /Resumen financiero/ }));
    expect(alSeleccionar).toHaveBeenCalledWith('financial');
  });

  it('el historial lleva el número de fichajes', () => {
    render(<BarraPestanas activa="live" onSeleccionar={() => {}} contadorFichajes={103} />);
    expect(screen.getByRole('tab', { name: /Historial de fichajes/ }).textContent).toContain('103');
  });
});

describe('BarraInferior', () => {
  it('atajos de móvil en su orden, marca la activa y abre el menú', () => {
    const alSeleccionar = vi.fn(); const alAbrirMenu = vi.fn();
    render(<BarraInferior activa="balances" onSeleccionar={alSeleccionar} onAbrirMenu={alAbrirMenu} />);
    const botones = screen.getAllByRole('button').map(b => b.textContent);
    expect(botones).toEqual(['En vivo', 'Cuadrante', 'Saldos', 'Grafo', 'Menú']);
    expect(screen.getByRole('button', { name: 'Saldos' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Grafo' }));
    expect(alSeleccionar).toHaveBeenCalledWith('graph');
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));
    expect(alAbrirMenu).toHaveBeenCalled();
  });
});
