import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import FichaTrabajador from './FichaTrabajador';

describe('FichaTrabajador', () => {
  it('"a partir de las 15:00" todas las semanas: se añade y se guarda en su ficha', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'Conductor Extra' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '15:00' } }); // "hasta" vacío = a partir de las 15:00
    fireEvent.click(screen.getByRole('button', { name: /Añadir disponibilidad/ }));
    expect(screen.getByText('desde las 15:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ avatar: '👤', role: 'Conductor Extra', backup: false, nota: '', rate: 10, disponibilidad: [{ dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' }] }));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado.');
  });

  it('"cuando no está en cocina": solo si hace falta y con nota', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'Apoyo Logística & Prep' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Solo si hace falta/ }));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'cuando no está en cocina' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ backup: true, nota: 'cuando no está en cocina' })));
  });

  it('BUG evitado: el horario escrito sin pulsar «Añadir disponibilidad» se perdía al guardar', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'Conductor Extra' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: 'entresemana' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '15:30' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    const { disponibilidad } = onGuardar.mock.calls[0][0];
    expect(disponibilidad).toHaveLength(5);
    expect(disponibilidad.every(r => r.desde === '15:30' && r.hasta === '23:59')).toBe(true);
    expect(screen.getByText('desde las 15:30 de lunes a viernes')).toBeInTheDocument();
  });

  it('volver con cambios sin guardar pregunta antes; sin cambios, vuelve directamente', async () => {
    const onCerrar = vi.fn();
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'x', avatar: '🧹' }} onGuardar={vi.fn()} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Cocina/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByText(/cambios en la ficha que no has guardado/)).toBeInTheDocument();
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('un icono que no está en la lista se conserva («Actual»)', () => {
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'x', avatar: '🦊' }} onGuardar={vi.fn()} onCerrar={() => {}} />);
    expect(screen.getByRole('button', { name: /Actual/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('si no se guarda (sesión caducada), lo dice', async () => {
    render(<FichaTrabajador trabajador={{ name: 'Eva', role: 'x' }} onGuardar={vi.fn().mockResolvedValue(false)} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
  });
});

describe('FichaTrabajador — grupos de días', () => {
  it('"de lunes a viernes, desde las 15:00" es una sola etiqueta y se guarda un apunte por día', async () => {
    const onGuardar = vi.fn().mockResolvedValue(true);
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'Conductor Extra' }} onGuardar={onGuardar} onCerrar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: 'entresemana' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir disponibilidad/ }));
    expect(screen.getByText('desde las 15:00 de lunes a viernes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    const { disponibilidad } = onGuardar.mock.calls[0][0];
    expect(disponibilidad.map(r => r.dia)).toEqual(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
    expect(disponibilidad.every(r => r.tipo === 'solo' && r.desde === '15:00' && r.hasta === '23:59')).toBe(true);
  });

  it('quitar la etiqueta quita todo el grupo', () => {
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'x', disponibilidad: dias.map(dia => ({ dia, tipo: 'solo', desde: '15:00', hasta: '23:59' })) }} onGuardar={vi.fn()} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar: desde las 15:00 de lunes a viernes' }));
    expect(screen.queryByText(/desde las 15:00/)).toBeNull();
  });

  describe('tarifa por hora', () => {
    // Horas locales, sin depender de la zona de la máquina.
    const a = (dia, hora) => new Date(2026, 9, dia, hora).toISOString();
    const fichajes = [
      { id: 'e1', workerName: 'Luis', type: 'entrada', timestamp: a(1, 9), rate: 10 }, { id: 's1', workerName: 'Luis', type: 'salida', timestamp: a(1, 14), rate: 10 },
      { id: 'e2', workerName: 'Luis', type: 'entrada', timestamp: a(4, 10), rate: 10 }, { id: 's2', workerName: 'Luis', type: 'salida', timestamp: a(4, 17), rate: 10 },
      { id: 'x1', workerName: 'Ana', type: 'entrada', timestamp: a(4, 10), rate: 10 },
    ];
    const pintar = (props = {}) => {
      const p = { onGuardar: vi.fn().mockResolvedValue(true), onCambiarTarifa: vi.fn().mockResolvedValue(true), ...props };
      render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'x', rate: 10 }} onCerrar={() => {}} fichajes={fichajes} {...p} />);
      return p;
    };

    it('enseña la suya (14 en nómina fija si no tiene otra) y la guarda en su ficha', async () => {
      const onGuardar = vi.fn().mockResolvedValue(true);
      render(<FichaTrabajador trabajador={{ name: 'Pau', role: 'x', isPayroll: true }} onGuardar={onGuardar} onCerrar={() => {}} />);
      expect(screen.getByLabelText('Tarifa por hora (€)')).toHaveValue(14);
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '15.5' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ rate: 15.5 })));
    });

    it('sin fecha, solo cambia para los fichajes nuevos: los ya hechos no se tocan', async () => {
      const { onGuardar, onCambiarTarifa } = pintar();
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '12' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 })));
      expect(onCambiarTarifa).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent('Guardado.');
    });

    it('con «desde el día 4», pregunta antes y cambia solo sus fichajes de ese día en adelante', async () => {
      const { onGuardar, onCambiarTarifa } = pintar();
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '12' } });
      fireEvent.change(screen.getByLabelText('Cambiar fichajes desde'), { target: { value: '2026-10-04' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      expect(await screen.findByText(/Vas a poner a 12,00 €\/h 2 fichajes de Luis desde el 4 oct/)).toBeInTheDocument();
      expect(onGuardar).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Cambiarlos' }));
      await waitFor(() => expect(onCambiarTarifa).toHaveBeenCalledWith(['e2', 's2'], 12));
      expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 }));
      expect(await screen.findByRole('status')).toHaveTextContent('Guardado. 2 fichajes a 12,00 €/h.');
      expect(screen.getByLabelText('Cambiar fichajes desde')).toHaveValue('');
    });

    it('si se cancela el aviso, no se guarda nada', async () => {
      const { onGuardar, onCambiarTarifa } = pintar();
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '12' } });
      fireEvent.change(screen.getByLabelText('Cambiar fichajes desde'), { target: { value: '2026-10-04' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      await screen.findByText(/Vas a poner a 12,00 €\/h/);
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByText(/Vas a poner a 12,00 €\/h/)).toBeNull());
      expect(onGuardar).not.toHaveBeenCalled();
      expect(onCambiarTarifa).not.toHaveBeenCalled();
    });

    it('si algún fichaje no se guarda, lo dice y deja la fecha para repetirlo', async () => {
      pintar({ onCambiarTarifa: vi.fn().mockResolvedValue(false) });
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '12' } });
      fireEvent.change(screen.getByLabelText('Cambiar fichajes desde'), { target: { value: '2026-10-04' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cambiarlos' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('no todos sus fichajes');
      expect(screen.getByLabelText('Cambiar fichajes desde')).toHaveValue('2026-10-04');
    });

    it('una tarifa vacía o a cero no se guarda', async () => {
      const { onGuardar } = pintar();
      fireEvent.change(screen.getByLabelText('Tarifa por hora (€)'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Pon la tarifa');
      expect(onGuardar).not.toHaveBeenCalled();
    });

    it('sin acceso a los fichajes (onCambiarTarifa) no ofrece la fecha', () => {
      render(<FichaTrabajador trabajador={{ name: 'Luis', role: 'x' }} onGuardar={vi.fn()} onCerrar={() => {}} />);
      expect(screen.queryByLabelText('Cambiar fichajes desde')).toBeNull();
    });
  });
});
