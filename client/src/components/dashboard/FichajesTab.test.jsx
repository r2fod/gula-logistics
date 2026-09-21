import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FichajesTab from './FichajesTab';

let n = 0;
const f = (workerName, type, fecha, taskName = 'Tarea', extra = {}) => ({ id: `f${++n}`, workerName, type, timestamp: fecha.toISOString(), taskName, isPayroll: false, rate: 10, ...extra });
const d = (dia, h, m = 0) => new Date(2026, 8, dia, h, m);

const fichajes = [
  f('Ana', 'entrada', d(19, 20, 0), 'JORNADA'),
  f('Ana', 'salida', d(20, 1, 0), 'Jornada Operativa'),
  f('Ana', 'entrada', d(20, 9, 0), 'JORNADA'),
  f('Ana', 'salida', d(20, 13, 0), 'Jornada Operativa', { note: 'Finalizada tarea de prueba' }),
  f('Luis', 'entrada', d(20, 10, 0), 'Recogida Álamos'),
  f('Luis', 'salida', d(20, 12, 0), 'Recogida Álamos'),
  f('Eva', 'entrada', d(21, 9, 30), 'JORNADA'), // sigue fichada
];
const workers = [{ name: 'Ana', avatar: '🚚' }, { name: 'Luis', avatar: '📦' }];

const renderTab = (props = {}) => render(
  <FichajesTab clockEntries={fichajes} adminUnlocked={false} workersList={workers} handleOpenCreateEntry={vi.fn()} handleOpenEditEntry={vi.fn()} onDeleteClockEntry={vi.fn()} {...props} />
);
const grupo = (texto) => screen.getByRole('button', { name: new RegExp(texto.replace(' ', ',? ')) });

describe('FichajesTab', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 21, 12, 0)); });
  afterEach(() => vi.useRealTimers());

  it('agrupa por día: solo el más reciente abierto y el resto plegado, con el conteo de fichajes', () => {
    renderTab();
    expect(grupo('Lunes 21 de septiembre').getAttribute('aria-expanded')).toBe('true');
    expect(grupo('Domingo 20 de septiembre').getAttribute('aria-expanded')).toBe('false');
    expect(grupo('Sábado 19 de septiembre').getAttribute('aria-expanded')).toBe('false');
    expect(within(grupo('Domingo 20 de septiembre')).getByText('5 fichajes')).toBeTruthy();
  });

  it('marca hoy y ayer', () => {
    renderTab();
    expect(within(grupo('Lunes 21 de septiembre')).getByText('Hoy')).toBeTruthy();
    expect(within(grupo('Domingo 20 de septiembre')).getByText('Ayer')).toBeTruthy();
  });

  it('un día se abre y se cierra a mano, y "Desplegar todo" los abre todos', () => {
    renderTab();
    const dia = grupo('Domingo 20 de septiembre');
    fireEvent.click(dia);
    expect(dia.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(dia);
    expect(dia.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Desplegar todo/ }));
    expect(grupo('Sábado 19 de septiembre').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Plegar todo/ })).toBeTruthy();
  });

  it('cuenta las horas de los turnos en el día en que empiezan', () => {
    renderTab();
    expect(within(grupo('Sábado 19 de septiembre')).getByText('5 h en 1 turno')).toBeTruthy(); // 20:00 -> 01:00
    expect(within(grupo('Domingo 20 de septiembre')).getByText('6 h en 2 turnos')).toBeTruthy(); // Ana 9-13 + Luis 10-12
  });

  it('enseña quién sigue fichado y desde cuándo', () => {
    renderTab();
    const franja = screen.getByText('En turno ahora', { selector: 'span.uppercase' }).parentElement;
    expect(within(franja).getByText('Eva')).toBeTruthy();
    expect(within(franja).getByText(/desde las 09:30 · 2 h 30 min/)).toBeTruthy();
  });

  it('avisa si alguien lleva demasiado tiempo fichado (casi seguro un olvido)', () => {
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0));
    renderTab();
    expect(screen.getByText(/¿olvidó fichar la salida\?/)).toBeTruthy();
  });

  it('cada salida enseña lo que duró y costó su turno', () => {
    renderTab();
    fireEvent.click(grupo('Domingo 20 de septiembre'));
    expect(screen.getAllByText(/Turno 4 h/).length).toBeGreaterThan(0); // 9:00-13:00 a 10 €/h = 40 €
    expect(screen.getAllByText('40,00 €').length).toBeGreaterThan(0);
  });

  it('una salida de madrugada dice cuándo empezó su turno (no parece una salida sin entrada)', () => {
    renderTab();
    fireEvent.click(grupo('Domingo 20 de septiembre'));
    expect(screen.getByText(/empezó el sáb 19 a las 20:00/)).toBeTruthy(); // Ana: 20:00 del 19 -> 01:00 del 20
  });

  it('el buscador filtra, abre los días con resultados y se puede quitar', () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por persona/), { target: { value: 'alamos' } });
    expect(screen.queryByRole('button', { name: /Lunes,? 21 de septiembre/ })).toBeNull(); // Eva no coincide
    expect(grupo('Domingo 20 de septiembre').getAttribute('aria-expanded')).toBe('true');
    expect(within(grupo('Domingo 20 de septiembre')).getByText('2 fichajes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(grupo('Lunes 21 de septiembre')).toBeTruthy();
  });

  it('filtra por tipo y por persona; sin resultados lo dice y ofrece quitar los filtros', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /^Salidas/ }));
    expect(screen.queryByRole('button', { name: /Lunes,? 21 de septiembre/ })).toBeNull(); // el día de hoy solo tiene una entrada
    fireEvent.change(screen.getByLabelText('Filtrar por persona'), { target: { value: 'Eva' } });
    expect(screen.getByText('Ningún fichaje coincide con los filtros.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[0]);
    expect(grupo('Lunes 21 de septiembre')).toBeTruthy();
  });

  it('en solo lectura no hay acciones; con admin se puede editar, eliminar (con confirmación) y añadir', () => {
    const editar = vi.fn(); const borrar = vi.fn(); const crear = vi.fn();
    const { unmount } = renderTab();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.getByText('SOLO LECTURA')).toBeTruthy();
    unmount();

    renderTab({ adminUnlocked: true, handleOpenEditEntry: editar, onDeleteClockEntry: borrar, handleOpenCreateEntry: crear });
    fireEvent.click(screen.getByRole('button', { name: /Añadir fichaje manual/ }));
    expect(crear).toHaveBeenCalled();
    const filaEva = screen.getByText('Eva', { selector: 'span.truncate' }).closest('li');
    fireEvent.click(within(filaEva).getByRole('button', { name: 'Editar' }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ workerName: 'Eva' }));

    const confirmar = vi.spyOn(window, 'confirm');
    confirmar.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar el fichaje de Eva/ }));
    expect(borrar).not.toHaveBeenCalled(); // dijo que no
    confirmar.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar el fichaje de Eva/ }));
    expect(borrar).toHaveBeenCalledWith(fichajes[6].id);
    confirmar.mockRestore();
  });

  it('sin fichajes muestra un estado vacío, sin filtros', () => {
    renderTab({ clockEntries: [] });
    expect(screen.getByText('No hay fichajes registrados en el sistema.')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar por persona/)).toBeNull();
  });
});
