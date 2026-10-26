import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '../test/render';

vi.mock('../data/pushService', () => ({ subscribeToPush: vi.fn().mockResolvedValue(null) }));
vi.mock('./TaskFlowGraphView', () => ({ default: () => null }));
const { default: WorkerView } = await import('./WorkerView');

// Semana ficticia del 22 al 27 de septiembre de 2026 (lunes 28, cola).
const semana = {
  meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Operativa Activa' },
  schedule: { martes: { title: 'Martes', tasks: [{ id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [{ id: 's1', text: 'Devolución', timeFrame: '10:00 - 11:00', targetDay: 'Lunes', assigned: ['Ana'] }] },
};
const equipo = [{ name: 'Ana', role: 'Conductora', avatar: '🚚', rate: 10 }];
const pintar = (clockEntries = []) => render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={semana} clockEntries={clockEntries} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);

describe('WorkerView', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('en turno: el cronómetro avanza solo, segundo a segundo', () => {
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getAllByText('EN TURNO')[0]).toBeInTheDocument();
    expect(screen.getByText('1h 00m 00s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('1h 00m 03s')).toBeInTheDocument();
  });

  it('el trabajador ve lo que lleva ganado en su turno, subiendo en directo', () => {
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', rate: 10, timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getByText('Llevas ganado')).toBeInTheDocument();
    expect(screen.getByText('≈ 10,00 €')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(36000); });
    expect(screen.getByText('≈ 10,10 €')).toBeInTheDocument();
  });

  it('en nómina fija no se enseña (no cobra por horas)', () => {
    render(<WorkerView workerName="Luis" workersList={[{ name: 'Luis', isPayroll: true, rate: 14 }]} activeWeekData={semana}
      clockEntries={[{ id: 'e2', workerName: 'Luis', type: 'entrada', timestamp: new Date(2026, 8, 24, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    expect(screen.getAllByText('EN TURNO')[0]).toBeInTheDocument();
    expect(screen.queryByText('Llevas ganado')).toBeNull();
  });

  it('BUG evitado: las horas de la semana y del mes suman sus turnos cerrados (antes salía siempre 0 h) y cada salida dice cuánto duró', () => {
    const t = (d, h, m) => new Date(2026, 8, d, h, m).toISOString();
    const fichajes = [
      { id: 'a1', workerName: 'Ana', type: 'entrada', timestamp: t(22, 9, 0), taskName: 'JORNADA' },
      { id: 'a2', workerName: 'Ana', type: 'salida', timestamp: t(22, 12, 15) }, // 3 h 15 min → 3,5 h
      { id: 'a3', workerName: 'Ana', type: 'entrada', timestamp: t(23, 8, 0), taskName: 'JORNADA' },
      { id: 'a4', workerName: 'Ana', type: 'salida', timestamp: t(23, 9, 0) },
    ];
    render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={semana} clockEntries={fichajes} fichajesDeTodo={[
      ...fichajes,
      { id: 'b1', workerName: 'Ana', type: 'entrada', timestamp: t(8, 9, 0), taskName: 'JORNADA' }, // semana anterior, mismo mes
      { id: 'b2', workerName: 'Ana', type: 'salida', timestamp: t(8, 11, 0) },
    ]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    const resumen = screen.getByRole('region', { name: 'Tus horas y tu saldo' });
    expect(resumen.textContent).toMatch(/4,5\s?hsemana/);
    expect(resumen.textContent).toMatch(/6,5\s?hseptiembre/);
    fireEvent.click(screen.getByRole('button', { name: /Fichajes/ }));
    expect(screen.getByText(/Duración: 3,5\s?h/)).toBeInTheDocument();
    expect(screen.getByText(/Duración: 1\s?h/)).toBeInTheDocument();
  });

  it('los días van de martes a domingo y el lunes (cola) el último', () => {
    pintar();
    const chips = screen.getAllByRole('button').map(b => b.textContent).filter(t => /^(LUN|MAR|MIÉ|JUE|VIE|SÁB|DOM) \d/.test(t));
    expect(chips.map(t => t.slice(0, 3))).toEqual(['MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM', 'LUN']);
  });

  it('sin turno no enseña el cronómetro', () => {
    pintar();
    expect(screen.queryByText('Llevas ganado')).toBeNull();
    expect(screen.queryByText(/^\d+h \d\dm \d\ds$/)).toBeNull();
    expect(screen.queryByText('Fichar salida')).toBeNull();
  });
});

describe('WorkerView — aprovecha la pantalla', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('la cabecera y el botón de fichar van arriba (apilados) para acceso directo y sin huecos vacíos', () => {
    pintar();
    const titulo = screen.getByRole('heading', { level: 1 });
    const botonTareas = screen.getByRole('button', { name: /^Tareas/ });
    expect(titulo).toBeInTheDocument();
    expect(botonTareas).toBeInTheDocument();
    const botonFichar = screen.getByRole('button', { name: /INICIAR JORNADA|para fichar|Sin tareas pendientes/ });
    expect(botonFichar).toBeInTheDocument();
  });

  it('BUG evitado: un solo día se enseña a todo el ancho (antes ocupaba la mitad o la tercera parte y el resto quedaba vacío)', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /^Hoy/ }));
    const rejilla = screen.getByRole('heading', { level: 3, name: /Tareas Asignadas para/ }).closest('div').parentElement.querySelector('div.grid');
    expect(rejilla.className).not.toMatch(/md:grid-cols-2/);
    fireEvent.click(screen.getByRole('button', { name: /Toda la Semana/ }));
    expect(screen.getByRole('heading', { level: 3, name: /Desglose Completo/ }).closest('div').parentElement.querySelector('div.grid').className).toMatch(/md:grid-cols-2/);
  });

  it('BUG evitado: las tarjetas de días en cuadrante estiran con h-full para mantener la simetría de alturas', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Toda la Semana/ }));
    const tarjetas = screen.getByRole('heading', { level: 3, name: /Desglose Completo/ }).closest('div').parentElement.querySelectorAll('div.grid > div');
    tarjetas.forEach(t => expect(t.className).toMatch(/h-full/));
  });
});

describe('WorkerView — botón de fichar la entrada', () => {
  afterEach(() => vi.useRealTimers());
  const botonEntrada = () => screen.getAllByRole('button').find(b => /INICIAR JORNADA|para fichar|Sin tareas pendientes/.test(b.textContent));
  const a = (dia, h, m = 0) => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, dia, h, m, 0)); };

  it('antes de 5 min de la primera tarea está bloqueado y dice desde cuándo', () => {
    a(28, 9, 0); // la del lunes empieza a las 10:00
    pintar();
    expect(botonEntrada()).toBeDisabled();
    expect(botonEntrada()).toHaveTextContent('Espera 55 min para fichar');
    expect(screen.getByText(/Podrás fichar a partir de las 09:55 \(5 min antes de tu primera tarea\)/)).toBeInTheDocument();
  });

  it('a 5 min de la primera tarea se activa', () => {
    a(28, 9, 56);
    pintar();
    expect(botonEntrada()).toBeEnabled();
    expect(botonEntrada()).toHaveTextContent(/INICIAR JORNADA/);
  });

  it('BUG evitado: con solo tareas ya pasadas sin marcar no queda activo (antes lo estaba siempre)', () => {
    a(28, 12, 0); // la del martes y la del lunes ya terminaron y nadie las marcó
    pintar();
    expect(botonEntrada()).toBeDisabled();
    expect(botonEntrada()).toHaveTextContent('Sin tareas pendientes');
    expect(screen.getByText(/usa «O fichar otra tarea libre»/)).toBeInTheDocument();
  });

  it('con las fechas de la semana ilegibles no deja a nadie sin poder fichar', () => {
    a(28, 12, 0);
    render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={{ ...semana, meta: { dateRange: 'por decidir' } }} clockEntries={[]} onClockEntryCreated={vi.fn()} onToggleTask={vi.fn()} />);
    expect(botonEntrada()).toBeEnabled();
  });
});

describe('WorkerView — jornada abierta: la tarea en curso y «Marcar como completada»', () => {
  const t = (h, m) => new Date(2026, 8, 24, h, m).toISOString();
  const jueves = (extra = {}) => ({
    ...semana,
    schedule: { ...semana.schedule, jueves: { title: 'Jueves', tasks: [
      { id: 'j1', text: 'Boda Dos - Montaje', timeFrame: '09:00 - 13:00', assigned: ['Ana'], ...extra },
      { id: 'j2', text: 'Boda Dos - Limpieza', timeFrame: '14:00 - 16:00', assigned: ['Ana'] },
    ] } },
  });
  const entrada = { id: 'e1', workerName: 'Ana', type: 'entrada', timestamp: t(9, 0), taskName: 'JORNADA' };
  const pintarJornada = (semanaVista, fichajes, onClockEntryCreated = vi.fn()) => {
    render(<WorkerView workerName="Ana" workersList={equipo} activeWeekData={semanaVista} clockEntries={fichajes} onClockEntryCreated={onClockEntryCreated} onToggleTask={vi.fn()} />);
    return onClockEntryCreated;
  };

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 0)); });
  afterEach(() => vi.useRealTimers());

  it('BUG evitado: «Tarea en curso» enseña la próxima tarea del planning (antes ponía «JORNADA») y marcarla manda su referencia', () => {
    const onClockEntryCreated = pintarJornada(jueves(), [entrada]);
    const bloque = screen.getByText('TAREA EN CURSO').closest('div.bg-slate-950');
    expect(within(bloque).getByText('Boda Dos - Montaje')).toBeInTheDocument();
    expect(within(bloque).queryByText('JORNADA')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Marcar como completada/ }));
    const enviado = onClockEntryCreated.mock.calls[0][0];
    expect(enviado).toMatchObject({ type: 'fichaje', taskName: 'Boda Dos - Montaje', taskRef: { dayKey: 'jueves', taskIndex: 0, taskId: 'j1' } });
  });

  it('BUG evitado: tras marcar una tarea el bloque sigue con la siguiente y «Finalizar jornada» no cambia (el turno dejaba de llamarse JORNADA y todo desaparecía)', () => {
    const fichaje = { id: 'f1', workerName: 'Ana', type: 'fichaje', timestamp: t(9, 50), taskName: 'Boda Dos - Montaje', taskRef: { dayKey: 'jueves', taskIndex: 0, taskId: 'j1' } };
    pintarJornada(jueves({ completed: true }), [entrada, fichaje]);
    const bloque = screen.getByText('TAREA EN CURSO').closest('div.bg-slate-950');
    expect(within(bloque).getByText('Boda Dos - Limpieza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FINALIZAR JORNADA/ })).toBeInTheDocument();
  });

  it('sin más tareas pendientes lo dice y la jornada se puede finalizar', () => {
    pintarJornada({ ...semana, schedule: { martes: { title: 'Martes', tasks: [] } }, sundayMonday: { tasks: [] } }, [entrada]);
    expect(screen.getByText(/Estás al día/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FINALIZAR JORNADA/ })).toBeInTheDocument();
  });
});

describe('WorkerView — qué día es «hoy»', () => {
  afterEach(() => vi.useRealTimers());

  it('BUG evitado: el lunes 21 (cola de otra semana) marcaba «LUN 28 · HOY» y enseñaba sus tareas como de hoy', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 21, 10, 0, 0));
    pintar();
    expect(screen.queryByText('HOY')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Hoy \(/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Toda la Semana/ }).className).toMatch(/bg-amber-500/);
  });

  it('dentro de la semana, «hoy» es el día de la fecha de hoy', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 28, 9, 0, 0)); // lunes 28 = la cola de esta semana
    pintar();
    expect(screen.getByRole('button', { name: /^Hoy \(/ }).className).toMatch(/bg-amber-500/);
    expect(screen.getByText('HOY').closest('button')).toHaveTextContent(/28/);
  });
});

describe('WorkerView — la tarea de otro día no está «en curso»', () => {
  afterEach(() => vi.useRealTimers());

  it('en turno sin nada más hoy, la siguiente del martes sale como «PRÓXIMA TAREA», con su día', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 21, 10, 0, 0)); // lunes 21, antes de la semana
    pintar([{ id: 'e1', workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 21, 9, 0, 0).toISOString(), taskName: 'JORNADA' }]);
    expect(screen.getByText('PRÓXIMA TAREA')).toBeInTheDocument();
    expect(screen.queryByText('TAREA EN CURSO')).toBeNull();
    expect(screen.getByText('Martes 22 · 09:00 - 10:00')).toBeInTheDocument();
  });
});

describe('WorkerView — «Mis fichajes»', () => {
  it('BUG evitado: lo más reciente sale arriba aunque llegue al final de la lista (un fichaje recién hecho salía abajo del todo)', () => {
    const t = (d, h) => new Date(2026, 8, d, h, 0).toISOString();
    pintar([
      { id: 'b2', workerName: 'Ana', type: 'salida', timestamp: t(22, 12) },
      { id: 'b1', workerName: 'Ana', type: 'entrada', timestamp: t(22, 9), taskName: 'JORNADA' },
      { id: 'nuevo', workerName: 'Ana', type: 'entrada', timestamp: t(23, 9), taskName: 'JORNADA' }, // recién fichado: al final
    ]);
    fireEvent.click(screen.getByText(/^Fichajes \(3\)$/));
    const tarjetas = [...document.querySelectorAll('.block.sm\\:hidden > div')];
    expect(tarjetas[0].textContent).toMatch(/23/);
  });
});
