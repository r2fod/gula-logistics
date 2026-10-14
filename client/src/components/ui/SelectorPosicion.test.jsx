import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import SelectorPosicion from './SelectorPosicion';

describe('SelectorPosicion', () => {
  it('BUG evitado: tiene nombre para los lectores de pantalla (antes solo «#1») y avisa con la posición elegida', () => {
    const onChange = vi.fn();
    render(<SelectorPosicion currentIndex={0} totalItems={3} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Posición en la lista' }), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
