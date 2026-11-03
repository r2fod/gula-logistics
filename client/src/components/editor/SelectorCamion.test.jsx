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

describe('SelectorCamion: añadir vehículo', () => {
  const abrirCampo = () => fireEvent.change(screen.getByRole('combobox'), { target: { value: '__nuevo_vehiculo__' } });

  it('sin onAnadirVehiculo no sale la opción', () => {
    render(<SelectorCamion flota={[{ name: 'Camión A' }]} onCambiar={() => {}} />);
    expect(screen.queryByRole('option', { name: /Añadir vehículo/ })).toBeNull();
  });

  it('«+ Añadir vehículo…» abre un campo; Enter añade a la flota y lo elige', () => {
    const onCambiar = vi.fn(); const onAnadirVehiculo = vi.fn();
    render(<SelectorCamion flota={[{ name: 'Camión A' }]} onCambiar={onCambiar} onAnadirVehiculo={onAnadirVehiculo} />);
    expect(screen.getAllByRole('option').at(-1)).toHaveTextContent('+ Añadir vehículo…');
    abrirCampo();
    const campo = screen.getByLabelText('Nombre del vehículo nuevo');
    fireEvent.change(campo, { target: { value: 'Furgoneta B' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onAnadirVehiculo).toHaveBeenCalledWith('Furgoneta B');
    expect(onCambiar).toHaveBeenCalledWith('Furgoneta B');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('si ya existe en la flota (sin tildes ni mayúsculas) elige ese y no crea otro', () => {
    const onCambiar = vi.fn(); const onAnadirVehiculo = vi.fn();
    render(<SelectorCamion flota={[{ name: 'Camión A' }]} onCambiar={onCambiar} onAnadirVehiculo={onAnadirVehiculo} />);
    abrirCampo();
    fireEvent.change(screen.getByLabelText('Nombre del vehículo nuevo'), { target: { value: 'camion a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(onAnadirVehiculo).not.toHaveBeenCalled();
    expect(onCambiar).toHaveBeenCalledWith('Camión A');
  });

  it('Escape y Cancelar vuelven al selector sin añadir nada', () => {
    const onCambiar = vi.fn(); const onAnadirVehiculo = vi.fn();
    render(<SelectorCamion flota={[]} onCambiar={onCambiar} onAnadirVehiculo={onAnadirVehiculo} />);
    abrirCampo();
    fireEvent.keyDown(screen.getByLabelText('Nombre del vehículo nuevo'), { key: 'Escape' });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    abrirCampo();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(onAnadirVehiculo).not.toHaveBeenCalled();
    expect(onCambiar).not.toHaveBeenCalled();
  });
});
