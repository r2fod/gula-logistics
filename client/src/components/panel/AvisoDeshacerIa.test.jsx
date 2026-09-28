import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '../../test/render';
import AvisoDeshacerIa from './AvisoDeshacerIa';

describe('AvisoDeshacerIa', () => {
  it('pide confirmación y deshace; si hubo cambios después, lo advierte', async () => {
    const onDeshacer = vi.fn().mockResolvedValue(true);
    render(<AvisoDeshacerIa aviso={{ nombre: 'Semana 4' }} cambiada onDeshacer={onDeshacer} onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmación' });
    expect(dialogo).toHaveTextContent('esos cambios se perderán');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(onDeshacer).toHaveBeenCalled());
  });

  it('sin nada que deshacer no pinta nada', () => {
    const { container } = render(<AvisoDeshacerIa aviso={null} onDeshacer={vi.fn()} onCerrar={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
