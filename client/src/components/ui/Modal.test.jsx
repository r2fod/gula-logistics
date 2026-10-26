import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Modal from './Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('no pinta nada si no está abierto y no bloquea el scroll', () => {
    render(<Modal abierto={false} onCerrar={() => {}}>Contenido</Modal>);
    expect(screen.queryByText('Contenido')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('pinta un diálogo con su contenido y bloquea el scroll del fondo mientras está abierto', () => {
    const { unmount } = render(<Modal onCerrar={() => {}} etiqueta="Ajustes">Contenido</Modal>);
    expect(screen.getByRole('dialog', { name: 'Ajustes' })).toHaveTextContent('Contenido');
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('el botón de cerrar llama a onCerrar', () => {
    const onCerrar = vi.fn();
    render(<Modal onCerrar={onCerrar}>Contenido</Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('BUG evitado: la X queda fuera de la parte que hace scroll (antes subía con el contenido)', () => {
    render(<Modal onCerrar={() => {}} className="space-y-6">Contenido</Modal>);
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    const cuerpo = screen.getByText('Contenido');
    expect(cuerpo.className).toMatch(/overflow-y-auto/);
    expect(cuerpo.className).toMatch(/space-y-6/); // las clases del llamador van al contenido
    expect(cuerpo.contains(cerrar)).toBe(false);
  });

  it('botonCerrar={false} no pinta el botón (el modal pone el suyo en la cabecera)', () => {
    render(<Modal onCerrar={() => {}} botonCerrar={false}>Contenido</Modal>);
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });

  it('Escape cierra el modal', () => {
    const onCerrar = vi.fn();
    render(<Modal onCerrar={onCerrar}>Contenido</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('otras teclas no lo cierran, y cerrarConEscape={false} lo desactiva', () => {
    const onCerrar = vi.fn();
    const { rerender } = render(<Modal onCerrar={onCerrar}>Contenido</Modal>);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onCerrar).not.toHaveBeenCalled();

    rerender(<Modal onCerrar={onCerrar} cerrarConEscape={false}>Contenido</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('con dos modales abiertos, Escape solo cierra el de arriba', () => {
    const cerrarAbajo = vi.fn();
    const cerrarArriba = vi.fn();
    render(
      <>
        <Modal onCerrar={cerrarAbajo}>Abajo</Modal>
        <Modal onCerrar={cerrarArriba}>Arriba</Modal>
      </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrarArriba).toHaveBeenCalledTimes(1);
    expect(cerrarAbajo).not.toHaveBeenCalled();
  });

  it('usa siempre el último onCerrar sin volver a suscribirse', () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = render(<Modal onCerrar={primero}>Contenido</Modal>);
    rerender(<Modal onCerrar={segundo}>Contenido</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });

  it('acepta el ancho y la capa', () => {
    render(<Modal onCerrar={() => {}} ancho="4xl" capa={60}>Contenido</Modal>);
    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('max-w-4xl');
    expect(panel.parentElement.className).toContain('z-[60]');
  });

  it('BUG evitado: el foco entra en la ventana, Tab da la vuelta dentro y al cerrar vuelve a donde estaba (antes se quedaba detrás)', () => {
    const { rerender } = render(<><button>Abrir</button><Modal abierto={false} onCerrar={() => {}} botonCerrar={false}><h3>Flota</h3><button>Uno</button><button>Dos</button></Modal></>);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    abrir.focus();
    rerender(<><button>Abrir</button><Modal onCerrar={() => {}} botonCerrar={false}><h3>Flota</h3><button>Uno</button><button>Dos</button></Modal></>);
    const panel = screen.getByRole('dialog', { name: 'Flota' }); // sin etiqueta, su título le da nombre
    expect(document.activeElement).toBe(panel);
    screen.getByRole('button', { name: 'Dos' }).focus();
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Uno' }));
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dos' }));
    rerender(<><button>Abrir</button><Modal abierto={false} onCerrar={() => {}} botonCerrar={false}><h3>Flota</h3></Modal></>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }));
  });
});
