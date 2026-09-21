import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BarraProgreso from './BarraProgreso';

afterEach(cleanup);

const relleno = () => screen.getByRole('progressbar').firstElementChild;

describe('BarraProgreso', () => {
  it('el relleno mide el porcentaje y la barra lo anuncia', () => {
    render(<BarraProgreso porcentaje={40} etiqueta="Progreso" />);
    expect(screen.getByRole('progressbar', { name: 'Progreso' })).toHaveAttribute('aria-valuenow', '40');
    expect(relleno().style.width).toBe('40%');
  });

  it('acota los valores fuera de rango o inválidos', () => {
    const { rerender } = render(<BarraProgreso porcentaje={130} />);
    expect(relleno().style.width).toBe('100%');
    rerender(<BarraProgreso porcentaje={-5} />);
    expect(relleno().style.width).toBe('0%');
    rerender(<BarraProgreso porcentaje={NaN} />);
    expect(relleno().style.width).toBe('0%');
    rerender(<BarraProgreso porcentaje={Infinity} />);
    expect(relleno().style.width).toBe('0%');
  });

  it('acepta las clases de pista y de relleno', () => {
    render(<BarraProgreso porcentaje={10} pista="h-1 bg-red-500" relleno="bg-blue-500" />);
    expect(screen.getByRole('progressbar').className).toContain('h-1 bg-red-500');
    expect(relleno().className).toContain('bg-blue-500');
  });
});
