import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Clock } from 'lucide-react';
import Tarjeta from './Tarjeta';
import EstadoVacio from './EstadoVacio';

afterEach(cleanup);

describe('Tarjeta', () => {
  it('pinta su contenido con la superficie de la variante', () => {
    render(<Tarjeta variante="panel" className="p-6" data-testid="t">Hola</Tarjeta>);
    const t = screen.getByTestId('t');
    expect(t).toHaveTextContent('Hola');
    expect(t.className).toContain('rounded-3xl');
    expect(t.className).toContain('p-6');
  });

  it('por defecto es un recuadro y una variante desconocida no rompe', () => {
    const { rerender } = render(<Tarjeta data-testid="t" />);
    expect(screen.getByTestId('t').className).toContain('bg-slate-950 border border-slate-800 rounded-2xl');
    rerender(<Tarjeta variante="inventada" data-testid="t" />);
    expect(screen.getByTestId('t').className).toContain('rounded-2xl');
  });

  it('puede ser otra etiqueta', () => {
    render(<Tarjeta as="section" data-testid="t" />);
    expect(screen.getByTestId('t').tagName).toBe('SECTION');
  });
});

describe('EstadoVacio', () => {
  it('muestra título y detalle', () => {
    render(<EstadoVacio icono={Clock} titulo="No hay nada" detalle="Vuelve luego" />);
    expect(screen.getByText('No hay nada')).toBeInTheDocument();
    expect(screen.getByText('Vuelve luego')).toBeInTheDocument();
  });

  it('el detalle es opcional', () => {
    const { container } = render(<EstadoVacio icono={Clock} titulo="No hay nada" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
