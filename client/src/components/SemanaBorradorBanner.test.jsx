import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SemanaBorradorBanner from './SemanaBorradorBanner';

const semana = { meta: { status: 'Borrador', avisos: ['Evento X: sin hora en el calendario', 'Falta gente el martes'] } };

describe('SemanaBorradorBanner', () => {
  it('avisa de que es un borrador y lista los avisos del generador', () => {
    render(<SemanaBorradorBanner week={semana} adminUnlocked onAceptar={() => {}} />);
    expect(screen.getByText(/Semana en BORRADOR/)).toBeInTheDocument();
    expect(screen.getByText('Evento X: sin hora en el calendario')).toBeInTheDocument();
    expect(screen.getByText('Falta gente el martes')).toBeInTheDocument();
  });

  it('el admin puede aceptar y regenerar', () => {
    const aceptar = vi.fn(); const regenerar = vi.fn();
    render(<SemanaBorradorBanner week={semana} adminUnlocked onAceptar={aceptar} onRegenerar={regenerar} />);
    fireEvent.click(screen.getByRole('button', { name: /Aceptar y activar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Regenerar desde el calendario/ }));
    expect(aceptar).toHaveBeenCalledTimes(1);
    expect(regenerar).toHaveBeenCalledTimes(1);
  });

  it('quien no es admin no ve botones, solo el motivo', () => {
    render(<SemanaBorradorBanner week={semana} adminUnlocked={false} onAceptar={() => {}} onRegenerar={() => {}} />);
    expect(screen.queryByRole('button', { name: /Aceptar y activar/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo un administrador puede aceptarla/)).toBeInTheDocument();
  });

  it('sin avisos no pinta la lista', () => {
    render(<SemanaBorradorBanner week={{ meta: { status: 'Borrador' } }} adminUnlocked onAceptar={() => {}} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
