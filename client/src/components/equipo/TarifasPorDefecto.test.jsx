import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import { usarTarifasPorDefecto } from '../../data/tarifasPorDefecto';
import TarifasPorDefecto from './TarifasPorDefecto';
import AvisoSinTarifa from './AvisoSinTarifa';

const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('TarifasPorDefecto', () => {
  it('enseña las guardadas y guarda solo los números válidos (lo vacío queda sin dato)', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<TarifasPorDefecto tarifas={{ extra: 11, nomina: 15 }} equipo={[]} onGuardar={onGuardar} />);
    expect(screen.getByLabelText('Fuera de nómina (€/h)')).toHaveValue(11);
    expect(screen.getByLabelText('Ayuda de transporte (€/día)')).toHaveValue(null);
    escribir('Ayuda de transporte (€/día)', '8.5');
    fireEvent.click(screen.getByRole('button', { name: /Guardar tarifas/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ extra: 11, nomina: 15, transporte: 8.5 }));
    expect(await screen.findByText('Guardadas.')).toBeInTheDocument();
  });

  it('un valor no válido no se guarda y dice cuál es', () => {
    const onGuardar = vi.fn();
    render(<TarifasPorDefecto tarifas={{}} equipo={[]} onGuardar={onGuardar} />);
    escribir('En nómina fija (€/h)', '500');
    fireEvent.click(screen.getByRole('button', { name: /Guardar tarifas/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('En nómina fija');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('si no se pudo guardar (sin red o sin sesión), lo dice', async () => {
    render(<TarifasPorDefecto tarifas={{ extra: 10 }} equipo={[]} onGuardar={vi.fn().mockResolvedValue(false)} />);
    fireEvent.click(screen.getByRole('button', { name: /Guardar tarifas/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar');
  });

  it('BUG evitado: avisa de quién se queda sin tarifa (ni la suya ni la por defecto): sus horas saldrían a 0 sin que nadie lo viera', () => {
    usarTarifasPorDefecto({});
    render(<TarifasPorDefecto tarifas={{}} equipo={[{ name: 'Ana', rate: 12 }, { name: 'Luis' }]} onGuardar={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin tarifa (ni la suya ni la por defecto): Luis');
  });
});

describe('AvisoSinTarifa (arriba del panel, solo admin)', () => {
  it('lista a quien no tiene tarifa y abre Gestionar equipo', () => {
    usarTarifasPorDefecto({});
    const abrir = vi.fn();
    render(<AvisoSinTarifa equipo={[{ name: 'Ana', rate: 12 }, { name: 'Luis' }, { name: 'Eva', isPayroll: true }]} onAbrirEquipo={abrir} />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin tarifa por hora: Luis, Eva');
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar equipo' }));
    expect(abrir).toHaveBeenCalled();
  });

  it('con tarifa por defecto (o la suya) para todos, no sale', () => {
    usarTarifasPorDefecto({ extra: 10, nomina: 14 });
    const { container } = render(<AvisoSinTarifa equipo={[{ name: 'Ana' }, { name: 'Eva', isPayroll: true }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TarifasPorDefecto — se queda abierta al guardar', () => {
  it('BUG evitado: al guardar lo que faltaba, la sección no se cierra sola (se perdía el «Guardadas.»)', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    const { rerender, container } = render(<TarifasPorDefecto tarifas={{}} equipo={[]} onGuardar={onGuardar} />);
    expect(container.querySelector('details').open).toBe(true);
    escribir('Fuera de nómina (€/h)', '10');
    escribir('En nómina fija (€/h)', '14');
    escribir('Ayuda de transporte (€/día)', '8');
    fireEvent.click(screen.getByRole('button', { name: /Guardar tarifas/ }));
    await screen.findByText('Guardadas.');
    rerender(<TarifasPorDefecto tarifas={{ extra: 10, nomina: 14, transporte: 8 }} equipo={[]} onGuardar={onGuardar} />);
    expect(container.querySelector('details').open).toBe(true);
    expect(screen.getByText('Guardadas.')).toBeInTheDocument();
  });
});
