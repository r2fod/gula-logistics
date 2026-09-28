import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EstadoClaveIa from './EstadoClaveIa';

describe('EstadoClaveIa', () => {
  it('la clave del navegador va primero', () => {
    render(<EstadoClaveIa enNavegador enServidor={false} />);
    expect(screen.getByText(/clave guardada en este navegador/)).toBeTruthy();
  });

  it('sin clave en el navegador dice si el servidor tiene la suya', () => {
    const { rerender } = render(<EstadoClaveIa enServidor />);
    expect(screen.getByText(/clave del servidor/)).toBeTruthy();
    rerender(<EstadoClaveIa enServidor={false} />);
    expect(screen.getByRole('status').textContent).toContain('GEMINI_API_KEY');
  });

  it('si no se sabe (sin sesión o sin red), no dice nada', () => {
    const { container } = render(<EstadoClaveIa enServidor={null} />);
    expect(container.textContent).toBe('');
  });
});
