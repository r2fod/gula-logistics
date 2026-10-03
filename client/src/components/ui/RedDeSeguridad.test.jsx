import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/render';
import RedDeSeguridad from './RedDeSeguridad';

const Revienta = () => { throw new Error('fallo de prueba'); };

describe('RedDeSeguridad', () => {
  it('si algo revienta al pintarse, avisa y ofrece recargar en vez de dejar la pantalla oscura', () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RedDeSeguridad><Revienta /></RedDeSeguridad>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Algo ha fallado en esta pantalla')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Recargar/ })).toBeTruthy();
    silencio.mockRestore();
  });

  it('sin fallos, pinta lo de dentro tal cual', () => {
    render(<RedDeSeguridad><p>todo bien</p></RedDeSeguridad>);
    expect(screen.getByText('todo bien')).toBeTruthy();
  });
});
