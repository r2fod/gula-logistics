import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, renderHook, screen, fireEvent, act, waitFor } from '../test/render';
import { useDialog } from './DialogContext';
import Modal from '../components/ui/Modal';

const abrirDialogo = () => renderHook(() => useDialog()).result;

describe('Avisos y confirmaciones (useDialog)', () => {
  it('BUG evitado: Enter con el foco en «Cancelar» NO confirma (antes se escuchaba Enter en toda la página)', async () => {
    const dialogo = abrirDialogo();
    let respuesta;
    act(() => { dialogo.current.confirm('¿Eliminar la semana?', { type: 'delete' }).then(r => { respuesta = r; }); });
    const cancelar = await screen.findByRole('button', { name: 'Cancelar' });
    expect(document.activeElement).toBe(cancelar); // al borrar, el foco empieza en Cancelar
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(respuesta).toBeUndefined();
    fireEvent.click(cancelar);
    await waitFor(() => expect(respuesta).toBe(false));
  });

  it('BUG evitado: Escape cierra el aviso y NO la ventana de debajo', async () => {
    const onCerrar = vi.fn();
    render(<Modal onCerrar={onCerrar}><p>Flota</p></Modal>);
    const dialogo = abrirDialogo();
    let respuesta;
    act(() => { dialogo.current.confirm('¿Seguro?').then(r => { respuesta = r; }); });
    await screen.findByText('¿Seguro?');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(respuesta).toBe(false));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByText('Flota')).toBeInTheDocument();
  });

  it('BUG evitado: un segundo aviso espera su turno y el primero sigue pudiendo responderse', async () => {
    const dialogo = abrirDialogo();
    const respuestas = [];
    act(() => {
      dialogo.current.confirm('¿Deshacer la entrada?').then(r => respuestas.push(['primero', r]));
      dialogo.current.alert('No se ha fichado');
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(respuestas).toEqual([['primero', true]]));
    expect(await screen.findByText('No se ha fichado')).toBeInTheDocument();
  });
});
