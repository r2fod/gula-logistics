import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../../../test/render';
import PanelBolsa from './PanelBolsa';

// Bolsa de 10 h a 8 €/h y luego 12 €/h; 10 h ya apuntadas a mano.
const purseInfo = { totalHours: 10, consumedHours: 10, consumedValue: 80, hourlyRate: 8, extraRateAfter80h: 12, grossBase: 0, housingDeduction: 0, netFixedAt80h: 0, shifts: [] };
const ficha = (extra = {}) => ({ name: 'Eva', isSpecialPurse: true, purseInfo: { ...purseInfo, ...extra } });
const turno = (mes, dia, horas) => ({ durationHours: horas, startEntry: { timestamp: new Date(2026, mes, dia, 9).toISOString() } });

afterEach(cleanup);

describe('PanelBolsa', () => {
  it('sin meses en el acuerdo, como siempre: lo apuntado a mano y sin texto del mes', () => {
    render(<PanelBolsa ficha={ficha()} turnos={[turno(9, 2, 4)]} ahora={new Date(2026, 9, 5)} />);
    expect(screen.getByText('Bolsa Mensual (80h)')).toBeInTheDocument();
    expect(screen.getByText('100% Consumido')).toBeInTheDocument();
    expect(screen.queryByText(/Este mes:/)).toBeNull();
    expect(screen.queryByText('Meses del acuerdo')).toBeNull(); // sin admin
  });

  it('con el acuerdo por meses enseña la bolsa del mes en curso (a mano + fichado)', () => {
    render(<PanelBolsa ficha={ficha({ desde: '2026-09', hasta: '2026-10' })} turnos={[turno(8, 20, 6), turno(9, 2, 4)]} ahora={new Date(2026, 9, 5)} />);
    expect(screen.getByText(/Bolsa de octubre/)).toBeInTheDocument();
    expect(screen.getByText('40% Consumido')).toBeInTheDocument();
    expect(screen.getByText(/Este mes:/).textContent).toMatch(/4\s?h de 10\s?h/);
  });

  it('pasado el acuerdo, todo a la tarifa extra', () => {
    render(<PanelBolsa ficha={ficha({ desde: '2026-09', hasta: '2026-10' })} turnos={[]} ahora={new Date(2026, 10, 3)} />);
    expect(screen.getByText('Fuera del acuerdo')).toBeInTheDocument();
    expect(screen.getByText(/noviembre queda fuera del acuerdo/)).toBeInTheDocument();
  });

  it('el admin guarda los meses; mal escritos o al revés no deja', () => {
    const onGuardarMeses = vi.fn();
    render(<PanelBolsa ficha={ficha()} admin onGuardarMeses={onGuardarMeses} ahora={new Date(2026, 9, 5)} />);
    const guardar = screen.getByRole('button', { name: 'Guardar meses' });
    expect(guardar).toBeDisabled(); // sin cambios
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10' } });
    fireEvent.change(screen.getByLabelText('Hasta (incluido)'), { target: { value: '2026-09' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09' } });
    fireEvent.change(screen.getByLabelText('Hasta (incluido)'), { target: { value: '2026-10' } });
    fireEvent.click(guardar);
    expect(onGuardarMeses).toHaveBeenCalledWith({ desde: '2026-09', hasta: '2026-10' });
  });

  it('BUG evitado: si los meses llegan después (primero se pinta la copia del navegador), los campos se ponen al día y «Guardar» no los borra', () => {
    const onGuardarMeses = vi.fn();
    const { rerender } = render(<PanelBolsa ficha={ficha()} admin onGuardarMeses={onGuardarMeses} ahora={new Date(2026, 9, 5)} />);
    expect(screen.getByLabelText('Desde')).toHaveValue('');
    rerender(<PanelBolsa ficha={ficha({ desde: '2026-09', hasta: '2026-10' })} admin onGuardarMeses={onGuardarMeses} ahora={new Date(2026, 9, 5)} />);
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09');
    expect(screen.getByLabelText('Hasta (incluido)')).toHaveValue('2026-10');
    expect(screen.getByRole('button', { name: 'Guardar meses' })).toBeDisabled();
  });
});

