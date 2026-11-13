import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '../../test/render';
import BotonAccion from './BotonAccion';
import CabeceraPanel from './CabeceraPanel';
import MenuLateral from './MenuLateral';
import AvisarCambiosModal from './AvisarCambiosModal';
import { crearAcciones } from './acciones';

afterEach(cleanup);

const funciones = () => ({
  fichar: vi.fn(), avisar: vi.fn(), editarPlanning: vi.fn(), editarEquipo: vi.fn(), nominas: vi.fn(), gemini: vi.fn(),
  compartir: vi.fn(), copiarEnlaceSocias: vi.fn(), vistaPublica: vi.fn(), claves: vi.fn(), nuevaSemana: vi.fn(),
});

const equipo = [
  { name: 'Ana', avatar: '🚚' },
  { name: 'Luis', avatar: '👤' },
];

describe('BotonAccion', () => {
  const accion = (extra = {}) => ({ id: 'x', etiqueta: 'Corta', etiquetaMenu: 'Larga', icono: () => <svg data-testid="icono" />, tono: 'neutro', lugares: ['barra'], onClick: vi.fn(), ...extra });

  it('llama a su función y después a alPulsar', () => {
    const a = accion();
    const alPulsar = vi.fn();
    render(<BotonAccion accion={a} variante="barra" alPulsar={alPulsar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Corta' }));
    expect(a.onClick).toHaveBeenCalledTimes(1);
    expect(alPulsar).toHaveBeenCalledTimes(1);
  });

  it('el menú usa la etiqueta larga y las demás variantes la corta', () => {
    const a = accion();
    const { rerender } = render(<BotonAccion accion={a} variante="menu" />);
    expect(screen.getByRole('button', { name: 'Larga' })).toBeInTheDocument();
    rerender(<BotonAccion accion={a} variante="movil" />);
    expect(screen.getByRole('button', { name: 'Corta' })).toBeInTheDocument();
  });

  it('mientras carga está desactivado', () => {
    render(<BotonAccion accion={accion({ cargando: true })} variante="barra" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('un tono desconocido no rompe el botón', () => {
    render(<BotonAccion accion={accion({ tono: 'inventado' })} variante="barra" />);
    expect(screen.getByRole('button', { name: 'Corta' })).toBeInTheDocument();
  });
});

describe('CabeceraPanel', () => {
  const actualizada = '2026-09-15T12:00:00.000Z';
  const semanas = { a: { name: 'Semana 3', updatedAt: actualizada, meta: { dateRange: 'Del 15 al 20' } }, b: { id: 'b', name: 'Semana 4', updatedAt: actualizada, meta: { dateRange: 'Del 22 al 27', status: 'Borrador' } } };
  const pintar = (extra = {}) => {
    const fn = funciones();
    const props = {
      adminUnlocked: true, activeWeekData: semanas.a, allWeeks: semanas, activeWeekId: 'a', onSelectWeek: vi.fn(),
      acciones: crearAcciones({ admin: true }, fn), onSalir: vi.fn(), onDesbloquear: vi.fn(), onAbrirMenu: vi.fn(), ...extra,
    };
    const vista = render(<CabeceraPanel {...props} />);
    return { fn, props, ...vista };
  };

  const abrirEditor = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Editar semana' }));
    return screen.getByRole('dialog', { name: 'Editar semana' });
  };

  it('un admin ve su insignia, la clave, salir y el botón de nueva semana', () => {
    const { fn, props } = pintar();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clave' }));
    expect(fn.claves).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(fn.nuevaSemana).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(props.onSalir).toHaveBeenCalled();
  });

  it('BUG evitado: Clave y Salir son iguales (cuadrados de 36 px en el móvil, solo icono, y con nombre accesible); antes eran píldoras de distinto tamaño y Salir caía solo en otra línea', () => {
    pintar();
    const clave = screen.getByRole('button', { name: 'Clave' });
    const salir = screen.getByRole('button', { name: 'Salir' });
    for (const boton of [clave, salir]) {
      expect(boton.className).toMatch(/\bh-9\b/);
      expect(boton.className).toMatch(/\bw-9\b/);
      expect(boton.querySelector('svg')).not.toBeNull();
      expect(boton.querySelector('span')).toHaveClass('sr-only'); // el texto solo para lectores de pantalla en el móvil
    }
  });

  it('sin ser admin pide el acceso y no enseña las acciones de administración', () => {
    const fn = funciones();
    const { props } = pintar({ adminUnlocked: false, acciones: crearAcciones({ admin: false }, fn) });
    expect(screen.queryByText('ADMIN')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nóminas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar semana' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Admin Login' }));
    expect(props.onDesbloquear).toHaveBeenCalled();
  });

  it('oculta la edición si la semana seleccionada no existe en el selector', () => {
    pintar({ activeWeekId: 'ausente' });
    expect(screen.queryByRole('button', { name: 'Editar semana' })).toBeNull();
  });

  it('guarda el nombre con la clave y la versión que tenía la semana al abrir el editor', async () => {
    let resolver;
    const onRenombrarSemana = vi.fn(() => new Promise((resolve) => { resolver = resolve; }));
    const { rerender, props } = pintar({ onRenombrarSemana });
    const dialogo = abrirEditor();
    expect(within(dialogo).getByText('Del 15 al 20')).toBeInTheDocument();
    expect(within(dialogo).getByRole('textbox', { name: 'Nombre de la semana' })).toHaveValue('Semana 3');
    rerender(<CabeceraPanel {...props} activeWeekId="b" allWeeks={{ ...semanas, a: { ...semanas.a, updatedAt: '2026-09-16T12:00:00.000Z' } }} />);
    fireEvent.change(within(dialogo).getByRole('textbox', { name: 'Nombre de la semana' }), { target: { value: 'Semana 5' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(onRenombrarSemana).toHaveBeenCalledWith('a', 'Semana 5', actualizada);
    expect(within(dialogo).getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    resolver({ success: true });
    await waitFor(() => expect(dialogo).not.toBeInTheDocument());
  });

  it('mantiene el nombre escrito y explica el error si el guardado falla', async () => {
    const message = 'La semana cambió. Vuelve a abrir el editor.';
    pintar({ onRenombrarSemana: vi.fn().mockResolvedValue({ success: false, message }) });
    const dialogo = abrirEditor();
    const nombre = within(dialogo).getByRole('textbox', { name: 'Nombre de la semana' });
    fireEvent.change(nombre, { target: { value: 'Semana 5' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(message);
    expect(nombre).toHaveValue('Semana 5');
  });

  it.each(['a', 'b'])('mantiene abierto el editor de %s al cancelar o fallar la eliminación', async (activeWeekId) => {
    const message = 'La semana tiene fichajes asociados.';
    const onEliminarSemana = vi.fn().mockResolvedValueOnce({ cancelado: true }).mockResolvedValueOnce({ success: false, message }).mockResolvedValueOnce({ success: true });
    pintar({ activeWeekId, onEliminarSemana });
    const dialogo = abrirEditor();
    const eliminar = within(dialogo).getByRole('button', { name: 'Eliminar semana' });
    fireEvent.click(eliminar);
    expect(onEliminarSemana).toHaveBeenCalledWith(activeWeekId, actualizada, semanas[activeWeekId].name);
    await waitFor(() => expect(eliminar).toBeEnabled());
    expect(within(dialogo).queryByRole('alert')).toBeNull();
    fireEvent.click(eliminar);
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(message);
    fireEvent.click(eliminar);
    await waitFor(() => expect(dialogo).not.toBeInTheDocument());
  });

  it('Fichar y WhatsApp están en la barra rápida del móvil y en la de escritorio', () => {
    pintar();
    expect(screen.getAllByRole('button', { name: 'Fichar' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'WhatsApp' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Nóminas' })).toHaveLength(1);
  });

  it('el selector marca los borradores y cambia de semana', () => {
    const { props } = pintar();
    expect(screen.getByRole('option', { name: /Semana 4.*BORRADOR/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(props.onSelectWeek).toHaveBeenCalledWith('b');
  });

  it('el botón Menú abre el menú lateral', () => {
    const { props } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Menú' }));
    expect(props.onAbrirMenu).toHaveBeenCalled();
  });

  it('BUG evitado: en el ordenador "Más" abre el menú (antes Memoria IA y el borrador manual no se alcanzaban)', () => {
    const { props } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(props.onAbrirMenu).toHaveBeenCalledTimes(1);
  });
});

describe('MenuLateral', () => {
  const pintar = ({ admin = true, ...extra } = {}) => {
    const fn = funciones();
    const props = { abierto: true, onCerrar: vi.fn(), acciones: crearAcciones({ admin }, fn), adminUnlocked: admin, onSalir: vi.fn(), onDesbloquear: vi.fn(), ...extra };
    render(<MenuLateral {...props} />);
    return { fn, props };
  };

  it('cerrado no pinta nada', () => {
    pintar({ abierto: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un admin ve las tres secciones con sus acciones', () => {
    pintar();
    ['Operaciones & Turnos', 'Compartir & Accesos', 'Configuración'].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    ['Registrar fichaje', 'Editor de planning semanal', 'Nóminas y horas extra', 'Asistente IA Gemini', 'Compartir por WhatsApp', 'Claves y configuración', 'Añadir nueva semana']
      .forEach((t) => expect(screen.getByRole('button', { name: t })).toBeInTheDocument());
  });

  it('sin ser admin no hay sección de configuración y se ofrece desbloquear', () => {
    const { props } = pintar({ admin: false });
    expect(screen.queryByText('Configuración')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(props.onDesbloquear).toHaveBeenCalled();
    expect(props.onCerrar).toHaveBeenCalled();
  });

  it('pulsar una acción la ejecuta y cierra el menú', () => {
    const { fn, props } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar fichaje' }));
    expect(fn.fichar).toHaveBeenCalledTimes(1);
    expect(props.onCerrar).toHaveBeenCalledTimes(1);
  });

  it('salir cierra la sesión y el menú', () => {
    const { props } = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(props.onSalir).toHaveBeenCalled();
    expect(props.onCerrar).toHaveBeenCalled();
  });

  it('se cierra con Escape, con la X y pulsando fuera', () => {
    const { props } = pintar();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCerrar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Menú' }));
    expect(props.onCerrar).toHaveBeenCalledTimes(2);
    // El fondo oscuro que rodea al menú también lo cierra.
    fireEvent.click(screen.getByRole('dialog').firstElementChild);
    expect(props.onCerrar).toHaveBeenCalledTimes(3);
  });
});

describe('AvisarCambiosModal', () => {
  it('cerrado no pinta nada', () => {
    render(<AvisarCambiosModal abierto={false} onCerrar={() => {}} workersList={equipo} onEnviar={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin elegir a nadie se avisa a todos (lista vacía)', () => {
    const onEnviar = vi.fn();
    render(<AvisarCambiosModal abierto onCerrar={() => {}} workersList={equipo} onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar Aviso/ }));
    expect(onEnviar).toHaveBeenCalledWith([]);
  });

  it('se puede elegir y quitar a personas concretas', () => {
    const onEnviar = vi.fn();
    render(<AvisarCambiosModal abierto onCerrar={() => {}} workersList={equipo} onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    fireEvent.click(screen.getByRole('button', { name: /Luis/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar Aviso/ }));
    expect(onEnviar).toHaveBeenCalledWith(['Luis']);
  });

  it('"Avisar a Todos" deja la elección vacía', () => {
    const onEnviar = vi.fn();
    render(<AvisarCambiosModal abierto onCerrar={() => {}} workersList={equipo} onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    fireEvent.click(screen.getByRole('button', { name: /Avisar a Todos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar Aviso/ }));
    expect(onEnviar).toHaveBeenCalledWith([]);
  });

  it('al volver a abrirlo empieza sin nadie elegido', () => {
    const onEnviar = vi.fn();
    const props = { onCerrar: () => {}, workersList: equipo, onEnviar };
    const { rerender } = render(<AvisarCambiosModal abierto {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }));
    rerender(<AvisarCambiosModal abierto={false} {...props} />);
    rerender(<AvisarCambiosModal abierto {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Enviar Aviso/ }));
    expect(onEnviar).toHaveBeenCalledWith([]);
  });

  it('mientras envía, el botón está desactivado', () => {
    render(<AvisarCambiosModal abierto onCerrar={() => {}} workersList={equipo} enviando onEnviar={() => {}} />);
    expect(screen.getByRole('button', { name: /Enviando Aviso/ })).toBeDisabled();
  });
});
