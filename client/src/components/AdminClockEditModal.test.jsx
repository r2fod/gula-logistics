import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test/render';
import AdminClockEditModal from './AdminClockEditModal';

const equipo = [
  { name: 'Ana', role: 'Conductora', avatar: '🚚', rate: 12, isPayroll: false },
  { name: 'Luis', role: 'Base', avatar: '👤', isPayroll: true },
];

const fichaje = {
  id: 'f-1',
  workerName: 'Ana',
  role: 'Conductora',
  type: 'entrada',
  timestamp: new Date('2026-09-20T08:30').toISOString(),
  rate: 12,
  taskName: 'Boda A - Carga',
};

afterEach(cleanup);

const pintar = (props = {}) => {
  const llamadas = { onClose: vi.fn(), onUpdateEntry: vi.fn(), onDeleteEntry: vi.fn(), onClockEntryCreated: vi.fn() };
  render(<AdminClockEditModal isOpen workersList={equipo} {...llamadas} {...props} />);
  return llamadas;
};

const campo = (etiqueta) => screen.getByLabelText(etiqueta);

describe('AdminClockEditModal', () => {
  it('cerrado no pinta nada', () => {
    pintar({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('crea un fichaje manual con el trabajador, el tipo, la hora y la tarifa elegidos', () => {
    const { onClockEntryCreated, onUpdateEntry, onClose } = pintar();
    expect(screen.getByText('Nuevo Fichaje Manual')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar Fichaje/ })).toBeNull();

    fireEvent.change(campo('Tipo de Registro'), { target: { value: 'salida' } });
    fireEvent.change(campo('Fecha y Hora Exacta'), { target: { value: '2026-09-21T19:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Fichaje/ }));

    expect(onUpdateEntry).not.toHaveBeenCalled();
    expect(onClockEntryCreated).toHaveBeenCalledTimes(1);
    const creado = onClockEntryCreated.mock.calls[0][0];
    expect(creado).toMatchObject({
      workerName: 'Ana',
      role: 'Conductora',
      type: 'salida',
      timestamp: new Date('2026-09-21T19:00').toISOString(),
      taskName: 'Cierre de Jornada',
      note: '',
      editedByAdmin: true,
    });
    expect(creado.id).toEqual(expect.any(String));
    expect(onClose).toHaveBeenCalled();
  });

  it('al cambiar de trabajador toma su tarifa (nómina sin tarifa propia: 14 €/h)', () => {
    const { onClockEntryCreated } = pintar();
    fireEvent.change(campo('Trabajador'), { target: { value: 'Luis' } });
    expect(campo('Tarifa Hora (€/h)')).toHaveValue(14);
    fireEvent.change(campo('Concepto / Tarea / Nota de Modificación'), { target: { value: '  Montaje extra  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Fichaje/ }));
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({
      workerName: 'Luis', isPayroll: true, rate: 14, taskName: 'Montaje extra', note: 'Montaje extra', type: 'entrada',
    });
  });

  it('sin nadie en el equipo no crea nada', () => {
    const { onClockEntryCreated, onClose } = pintar({ workersList: [] });
    fireEvent.click(screen.getByRole('button', { name: /Crear Fichaje/ }));
    expect(onClockEntryCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('al editar precarga el fichaje y guarda con el MISMO id (no crea otro)', () => {
    const { onUpdateEntry, onClockEntryCreated, onClose } = pintar({ entry: fichaje });
    expect(screen.getByText('Modificar Fichaje')).toBeInTheDocument();
    expect(campo('Fecha y Hora Exacta')).toHaveValue('2026-09-20T08:30');
    expect(campo('Tipo de Registro')).toHaveValue('entrada');
    expect(campo('Concepto / Tarea / Nota de Modificación')).toHaveValue('Boda A - Carga');

    fireEvent.change(campo('Fecha y Hora Exacta'), { target: { value: '2026-09-20T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    expect(onClockEntryCreated).not.toHaveBeenCalled();
    expect(onUpdateEntry).toHaveBeenCalledWith(expect.objectContaining({
      id: 'f-1',
      workerName: 'Ana',
      timestamp: new Date('2026-09-20T09:00').toISOString(),
      taskName: 'Boda A - Carga',
      rate: 12,
      editedByAdmin: true,
      editedAt: expect.any(String),
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('borrar pide confirmación: «Cancelar» no borra y «Sí, Eliminar» lo manda a borrar', () => {
    const { onDeleteEntry, onClose } = pintar({ entry: fichaje });
    fireEvent.click(screen.getByRole('button', { name: /Eliminar Fichaje/ }));
    expect(screen.getByText(/¿Seguro que quieres borrar este fichaje\?/)).toBeInTheDocument();
    // Mientras se confirma no se puede guardar a la vez.
    expect(screen.queryByRole('button', { name: /Guardar Cambios/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onDeleteEntry).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Guardar Cambios/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Eliminar Fichaje/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, Eliminar/ }));
    expect(onDeleteEntry).toHaveBeenCalledWith('f-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('si el fichaje tiene pareja, avisa de que el turno quedará descuadrado', () => {
    pintar({ entry: fichaje, pairedEntry: { type: 'salida', timeFormatted: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Eliminar Fichaje/ }));
    expect(screen.getByText(/quedará descuadrado/)).toBeInTheDocument();
    expect(screen.getByText('SALIDA')).toBeInTheDocument();
  });

  it('desde la vista del trabajador solo añade (sin marca de admin) y no ofrece borrar', () => {
    const { onClockEntryCreated } = pintar({ isAdmin: false, workersList: [equipo[0]] });
    expect(screen.queryByText('ADMIN ONLY')).toBeNull();
    expect(screen.getByText(/Esto crea un fichaje nuevo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Crear Fichaje/ }));
    expect(onClockEntryCreated.mock.calls[0][0]).toMatchObject({ workerName: 'Ana', editedByAdmin: false, taskName: 'Inicio de Jornada Operativa' });
  });

  it('«Cancelar» cierra sin guardar', () => {
    const { onClose, onClockEntryCreated } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onClockEntryCreated).not.toHaveBeenCalled();
  });

  it('BUG evitado: lo escrito no se borra cuando la pantalla de detrás se repinta (WorkerView pasa un `[trabajador]` nuevo cada 15 s)', () => {
    const props = { isOpen: true, isAdmin: false, onClose: vi.fn(), onClockEntryCreated: vi.fn() };
    const { rerender } = render(<AdminClockEditModal {...props} workersList={[{ ...equipo[0] }]} />);
    fireEvent.change(campo('Concepto / Tarea / Nota de Modificación'), { target: { value: 'Se me olvidó fichar la carga' } });
    fireEvent.change(campo('Fecha y Hora Exacta'), { target: { value: '2026-09-20T07:00' } });
    rerender(<AdminClockEditModal {...props} workersList={[{ ...equipo[0] }]} />);
    expect(campo('Concepto / Tarea / Nota de Modificación')).toHaveValue('Se me olvidó fichar la carga');
    expect(campo('Fecha y Hora Exacta')).toHaveValue('2026-09-20T07:00');
  });

  it('al volver a abrirlo empieza de cero, y al abrir otro fichaje carga ese', () => {
    const props = { workersList: equipo, onClose: vi.fn(), onUpdateEntry: vi.fn(), onClockEntryCreated: vi.fn() };
    const { rerender } = render(<AdminClockEditModal {...props} isOpen />);
    fireEvent.change(campo('Concepto / Tarea / Nota de Modificación'), { target: { value: 'a medias' } });
    rerender(<AdminClockEditModal {...props} isOpen={false} />);
    rerender(<AdminClockEditModal {...props} isOpen />);
    expect(campo('Concepto / Tarea / Nota de Modificación')).toHaveValue('');
    rerender(<AdminClockEditModal {...props} isOpen entry={fichaje} />);
    expect(campo('Concepto / Tarea / Nota de Modificación')).toHaveValue('Boda A - Carga');
    rerender(<AdminClockEditModal {...props} isOpen entry={{ ...fichaje, id: 'f-2', taskName: 'Boda B - Descarga' }} />);
    expect(campo('Concepto / Tarea / Nota de Modificación')).toHaveValue('Boda B - Descarga');
  });
});

