import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Clock } from 'lucide-react';
import CabeceraModal from './CabeceraModal';

afterEach(cleanup);

describe('CabeceraModal', () => {
  it('muestra título, subtítulo e insignia', () => {
    render(<CabeceraModal icono={Clock} titulo="Fichar" subtitulo="Hora de entrada" insignia={<span>ADMIN</span>} />);
    expect(screen.getByRole('heading', { name: 'Fichar' })).toBeInTheDocument();
    expect(screen.getByText('Hora de entrada')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('sin subtítulo no pinta el párrafo', () => {
    const { container } = render(<CabeceraModal icono={Clock} titulo="Fichar" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('pinta las acciones a la derecha', () => {
    render(<CabeceraModal icono={Clock} titulo="Fichar" acciones={<button>Ajustar</button>} />);
    expect(screen.getByRole('button', { name: 'Ajustar' })).toBeInTheDocument();
  });

  it('el degradado usa el anillo de color y el tono la caja tintada', () => {
    const { container, rerender } = render(<CabeceraModal icono={Clock} titulo="A" degradado="amber-indigo" />);
    expect(container.querySelector('.bg-gradient-to-tr')).not.toBeNull();
    rerender(<CabeceraModal icono={Clock} titulo="A" tono="emerald" />);
    expect(container.querySelector('.bg-gradient-to-tr')).toBeNull();
    expect(container.querySelector('.text-emerald-400')).not.toBeNull();
  });
});
