import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '../test/render';
import ClockInModal from './ClockInModal';

const equipo = [
  { name: 'Ana', role: 'Mozo', rate: 10 },
  { name: 'Luis', role: 'Base', isPayroll: true },
];

const entradaAbierta = {
  id: 'e-1', workerName: 'Ana', type: 'entrada', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  timeFormatted: '08:00', taskName: 'Boda A - Carga',
};

afterEach(cleanup);

const pintar = (props = {}) => {
  const llamadas = { onClose: vi.fn(), onClockEntryCreated: vi.fn().mockResolvedValue(undefined) };
  render(<ClockInModal isOpen workersList={equipo} initialWorkerName="Ana" clockEntries={[]} {...llamadas} {...props} />);
  return llamadas;
};

const boton = (nombre) => screen.getByRole('button', { name: nombre });

describe('ClockInModal', () => {
  it('BUG evitado: abrir la ventana de fichar (montada cerrada, como en App) no tumba la app', () => {
    const props = { onClose: vi.fn(), workersList: equipo, clockEntries: [], onClockEntryCreated: vi.fn() };
    const { rerender } = render(<ClockInModal {...props} isOpen={false} />);
    expect(() => rerender(<ClockInModal {...props} isOpen />)).not.toThrow();
    expect(screen.getByText('Fichar Jornada Operativa')).toBeTruthy();
  });

  it('fuera de turno: ficha la ENTRADA de esa tarea con su referencia al planning y cierra', async () => {
    const taskRef = { day: 'tuesday', index: 0, weekId: 'week_1', taskId: 'm1', taskText: 'Boda A - Carga' };
    const { onClockEntryCreated, onClose } = pintar({ initialTaskName: 'Boda A - Carga', taskRef });
    expect(screen.getByText(/Actualmente fuera de turno/)).toBeInTheDocument();
    expect(boton(/Fichar Salida/)).toBeDisabled();

    fireEvent.click(boton(/Fichar Entrada/));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onClockEntryCreated).toHaveBeenCalledTimes(1);
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({
      workerName: 'Ana', role: 'Mozo', type: 'entrada', taskName: 'Boda A - Carga', note: 'Boda A - Carga', taskRef,
    });
  });

  it('sin tarea, la entrada va como «Inicio de Jornada Operativa» y sin referencia', async () => {
    const { onClockEntryCreated } = pintar();
    fireEvent.click(boton(/Fichar Entrada/));
    await waitFor(() => expect(onClockEntryCreated).toHaveBeenCalled());
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({ type: 'entrada', taskName: 'Inicio de Jornada Operativa', taskRef: null });
  });

  it('en turno: enseña la tarea abierta, bloquea otra entrada y ficha la SALIDA', async () => {
    const { onClockEntryCreated, onClose } = pintar({ clockEntries: [entradaAbierta] });
    expect(screen.getByText(/En Turno/)).toBeInTheDocument();
    expect(screen.getByText('Boda A - Carga')).toBeInTheDocument();
    expect(boton(/Fichar Entrada/)).toBeDisabled();

    fireEvent.click(boton(/Fichar Salida/));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({ workerName: 'Ana', type: 'salida' });
  });

  it('un doble toque ficha una sola vez', async () => {
    let terminar;
    const onClockEntryCreated = vi.fn(() => new Promise(r => { terminar = r; }));
    pintar({ onClockEntryCreated });
    fireEvent.click(boton(/Fichar Entrada/));
    fireEvent.click(boton(/Fichar Entrada/));
    terminar();
    await waitFor(() => expect(onClockEntryCreated).toHaveBeenCalledTimes(1));
  });

  it('ficha a nombre del trabajador elegido en el selector, con los datos de su ficha', async () => {
    const { onClockEntryCreated } = pintar({ clockEntries: [entradaAbierta] });
    fireEvent.change(screen.getByLabelText('Seleccionar Trabajador'), { target: { value: 'Luis' } });
    // Ana sigue en turno, Luis no: para él se puede fichar entrada.
    expect(screen.getByText(/Actualmente fuera de turno/)).toBeInTheDocument();
    fireEvent.click(boton(/Fichar Entrada/));
    await waitFor(() => expect(onClockEntryCreated).toHaveBeenCalled());
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({ workerName: 'Luis', role: 'Base', isPayroll: true, type: 'entrada' });
  });

  it('el admin puede fichar con otra hora (clic en el reloj); el trabajador no', async () => {
    const { onClockEntryCreated } = pintar({ isAdmin: true });
    fireEvent.click(screen.getByTitle('Haz clic para editar la hora manualmente'));
    const hora = document.querySelector('input[type="datetime-local"]');
    fireEvent.change(hora, { target: { value: '2026-09-20T07:45' } });
    fireEvent.click(boton(/Fichar Entrada/));
    await waitFor(() => expect(onClockEntryCreated).toHaveBeenCalled());
    expect(onClockEntryCreated.mock.calls[0][0].timestamp).toBe(new Date('2026-09-20T07:45').toISOString());

    cleanup();
    pintar();
    expect(screen.queryByTitle('Haz clic para editar la hora manualmente')).toBeNull();
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it('BUG evitado: si el equipo llega después de montar la ventana (móvil sin equipo guardado), no ficha con el nombre vacío', async () => {
    const onClockEntryCreated = vi.fn().mockResolvedValue(undefined);
    const props = { onClose: vi.fn(), clockEntries: [], onClockEntryCreated };
    const { rerender } = render(<ClockInModal {...props} isOpen={false} workersList={[]} />);
    rerender(<ClockInModal {...props} isOpen workersList={equipo} />);
    fireEvent.click(boton(/Fichar Entrada/));
    await waitFor(() => expect(onClockEntryCreated).toHaveBeenCalled());
    expect(onClockEntryCreated.mock.calls[0][0].workerName).toBe('Ana');
  });

  it('abre con el trabajador de ese momento y con la tarea que se pulsó (no con los del primer montaje)', () => {
    const props = { onClose: vi.fn(), workersList: equipo, clockEntries: [], onClockEntryCreated: vi.fn() };
    const { rerender } = render(<ClockInModal {...props} isOpen={false} initialWorkerName="Ana" />);
    rerender(<ClockInModal {...props} isOpen initialWorkerName="Luis" initialTaskName="Boda B - Montaje" />);
    expect(screen.getByLabelText('Seleccionar Trabajador')).toHaveValue('Luis');
    expect(screen.getByPlaceholderText('O escribe una tarea personalizada...')).toHaveValue('Boda B - Montaje');
    rerender(<ClockInModal {...props} isOpen={false} initialWorkerName="Luis" />);
    rerender(<ClockInModal {...props} isOpen initialWorkerName="Luis" />);
    expect(screen.getByPlaceholderText('O escribe una tarea personalizada...')).toHaveValue('');
  });
});

