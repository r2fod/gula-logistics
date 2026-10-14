import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import SelectorCamion from './SelectorCamion';
import { camionesParaElegir } from '../../data/flota';

describe('SelectorCamion', () => {
  it('BUG evitado: ofrece la flota de ESTA semana (antes tres camiones fijos: un alquiler nuevo no salía)', () => {
    expect(camionesParaElegir([{ name: 'Camión Gula' }, { name: 'Furgo Norte' }])).toEqual(['Camión Gula', 'Furgo Norte']);
  });

  it('BUG evitado: una tarea con un camión que no está en la flota lo sigue enseñando (antes se veía «Sin camión»)', () => {
    render(<SelectorCamion valor="Furgo Sur" flota={[{ name: 'Camión Gula' }]} onCambiar={() => {}} />);
    expect(screen.getByRole('combobox')).toHaveValue('Furgo Sur');
  });

  it('BUG evitado: sin flota guardada no inventa camiones (antes, tres fijos con empresas de alquiler escritas en el código); elegir uno avisa con su nombre', () => {
    const onCambiar = vi.fn();
    const { rerender } = render(<SelectorCamion flota={[]} onCambiar={onCambiar} />);
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Sin camión / no aplica']);
    rerender(<SelectorCamion flota={[{ name: 'Camión Sur' }]} onCambiar={onCambiar} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Camión Sur' } });
    expect(onCambiar).toHaveBeenCalledWith('Camión Sur');
  });
});
