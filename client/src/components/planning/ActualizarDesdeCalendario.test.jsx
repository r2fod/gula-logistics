import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../../test/render';
import ActualizarDesdeCalendario from './ActualizarDesdeCalendario';

const EQUIPO = [
  { name: 'Bruno', role: 'Conductor Flota (Veterano)' },
  { name: 'Carlos', role: 'Conductor Flota (Veterano)' },
  { name: 'Elena', role: 'Ayudante Logística / Prepara Eventos / Verifica Checklist' },
  { name: 'Lara', role: 'Gula Limpieza Eventos' },
];
const semana = {
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026', status: 'Operativa Activa' },
  events: [],
  schedule: { martes: { tasks: [] }, miercoles: { tasks: [] }, jueves: { tasks: [] }, viernes: { tasks: [] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [] },
};
const PRODU = { id: 'p', fecha: '2026-10-08', tipo: 'produccion', titulo: 'Produ Faro', pax: 40, hora: '13:00' };

afterEach(cleanup);

const pintar = (leerApuntes) => {
  const onGuardar = vi.fn();
  render(<ActualizarDesdeCalendario semana={semana} equipo={EQUIPO} onGuardar={onGuardar} leerApuntes={leerApuntes} />);
  fireEvent.click(screen.getByRole('button', { name: /Actualizar desde calendario/ }));
  return onGuardar;
};

describe('ActualizarDesdeCalendario', () => {
  it('pide al calendario la semana (martes a lunes), enseña lo que falta y añade solo lo marcado', async () => {
    const leer = vi.fn().mockResolvedValue({ configurado: true, apuntes: [PRODU] });
    const onGuardar = pintar(leer);
    expect(leer).toHaveBeenCalledWith('2026-10-06', '2026-10-12');
    expect(await screen.findByText('Produ Faro')).toBeInTheDocument();
    expect(screen.getByText('Producción')).toBeInTheDocument();
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas.length).toBeGreaterThan(1);
    fireEvent.click(casillas[0]); // se quita una
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Añadir ${casillas.length - 1} tareas al planning`) }));
    expect(onGuardar).toHaveBeenCalledTimes(1);
    const parcial = onGuardar.mock.calls[0][0];
    const anadidas = Object.values(parcial.schedule).flatMap(d => d.tasks);
    expect(anadidas).toHaveLength(casillas.length - 1);
    expect(parcial.events).toEqual([{ name: 'Produ Faro', pax: 40 }]);
    expect(parcial.meta).toBeUndefined(); // no toca el estado de la semana
    expect(await screen.findByRole('status')).toHaveTextContent(/Añadidas \d+ tareas de Produ Faro/);
  });

  it('si no falta nada, lo dice y no guarda', async () => {
    const onGuardar = pintar(vi.fn().mockResolvedValue({ configurado: true, apuntes: [] }));
    expect(await screen.findByRole('status')).toHaveTextContent('El planning ya tiene todos los eventos del calendario de esta semana.');
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('sin el calendario configurado o con error, lo explica', async () => {
    pintar(vi.fn().mockResolvedValue({ configurado: false, apuntes: [] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no está configurado/);
    cleanup();
    pintar(vi.fn().mockResolvedValue({ configurado: true, apuntes: [], error: 'HTTP 502' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el calendario: HTTP 502.');
  });

  it('«Descartar» cierra la propuesta sin guardar', async () => {
    const onGuardar = pintar(vi.fn().mockResolvedValue({ configurado: true, apuntes: [PRODU] }));
    await screen.findByText('Produ Faro');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText('Produ Faro')).toBeNull();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
