import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import KpiCard from './KpiCard';
import Seccion from './Seccion';
import Desplegable from './Desplegable';

describe('componentes de interfaz compartidos', () => {
  it('KpiCard formatea su valor con la función que se le pasa', () => {
    render(<KpiCard titulo="Coste" valor={1234.5} formato={(n) => `${n.toFixed(1)} €`} icono={Wallet} pie="pie de prueba" />);
    expect(screen.getByText('Coste')).toBeTruthy();
    expect(screen.getByText('1234.5 €')).toBeTruthy();
    expect(screen.getByText('pie de prueba')).toBeTruthy();
  });

  it('Seccion pinta cabecera, contenido y el pie fijo si se le da', () => {
    const { rerender } = render(<Seccion titulo="Título" subtitulo="apoyo"><p>contenido</p></Seccion>);
    expect(screen.getByRole('heading', { name: 'Título' })).toBeTruthy();
    expect(screen.getByText('apoyo')).toBeTruthy();
    expect(screen.getByText('contenido')).toBeTruthy();
    expect(screen.queryByText('totales')).toBeNull();
    rerender(<Seccion titulo="Título" pie={<span>totales</span>}><p>contenido</p></Seccion>);
    expect(screen.getByText('totales')).toBeTruthy();
  });

  it('Desplegable cerrado queda invisible (fuera del tabulador) y abierto, visible', () => {
    const { container, rerender } = render(<Desplegable abierto={false}><button>dentro</button></Desplegable>);
    expect(container.firstChild.className).toContain('invisible');
    expect(container.firstChild.className).toContain('grid-rows-[0fr]');
    rerender(<Desplegable abierto><button>dentro</button></Desplegable>);
    expect(container.firstChild.className).toContain('grid-rows-[1fr]');
    expect(container.firstChild.className).not.toContain('invisible');
  });
});
