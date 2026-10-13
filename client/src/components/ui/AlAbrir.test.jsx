import React, { lazy, useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import AlAbrir from './AlAbrir';
import { hayPrecargaEnCurso, precargarEnReposo } from '../../utils/precargar';

// Una ventana con estado propio, como las del panel: pinta algo solo si está abierta.
function Ventana({ abierta }) {
  const [veces, setVeces] = useState(0);
  return abierta ? <button type="button" onClick={() => setVeces(v => v + 1)}>Pulsada {veces}</button> : null;
}

describe('AlAbrir (ventanas que se bajan al abrirlas)', () => {
  it('no monta la ventana hasta que se abre, y al cerrarla conserva lo que tenía', () => {
    const montar = vi.fn();
    const Espia = (props) => { montar(); return <Ventana {...props} />; };
    const pintar = (abierta) => <AlAbrir abierto={abierta}><Espia abierta={abierta} /></AlAbrir>;
    const { rerender } = render(pintar(false));
    expect(montar).not.toHaveBeenCalled();

    rerender(pintar(true));
    fireEvent.click(screen.getByRole('button', { name: 'Pulsada 0' }));
    rerender(pintar(false));
    expect(screen.queryByRole('button')).toBeNull();
    rerender(pintar(true));
    expect(screen.getByRole('button', { name: 'Pulsada 1' })).toBeInTheDocument();
  });

  it('mientras se baja enseña «Cargando…» y luego la ventana', async () => {
    let entregar;
    const Lenta = lazy(() => new Promise((resolver) => { entregar = () => resolver({ default: () => <p>Ventana lista</p> }); }));
    render(<AlAbrir abierto><Lenta /></AlAbrir>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    entregar();
    expect(await screen.findByText('Ventana lista')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('precargarEnReposo', () => {
  afterEach(() => vi.useRealTimers());

  it('trae lo pendiente pasado un rato, no al momento; cancelado, no trae nada; si falla, no rompe', async () => {
    vi.useFakeTimers();
    const cargas = [vi.fn().mockResolvedValue({}), vi.fn().mockRejectedValue(new Error('sin red'))];
    precargarEnReposo(cargas, 1000);
    expect(cargas[0]).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cargas[0]).toHaveBeenCalledTimes(1);
    expect(cargas[1]).toHaveBeenCalledTimes(1);

    const otra = vi.fn().mockResolvedValue({});
    precargarEnReposo([otra], 1000)();
    await vi.advanceTimersByTimeAsync(2000);
    expect(otra).not.toHaveBeenCalled();
  });

  it('mientras trae algo lo dice (un fallo suyo no debe recargar la página) y sin red no lo intenta', async () => {
    vi.useFakeTimers();
    let terminar;
    precargarEnReposo([() => new Promise((_, rechazar) => { terminar = () => rechazar(new Error('sin red')); })], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(hayPrecargaEnCurso()).toBe(true);
    terminar();
    await vi.advanceTimersByTimeAsync(0);
    expect(hayPrecargaEnCurso()).toBe(false);

    const enLinea = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const carga = vi.fn().mockResolvedValue({});
    precargarEnReposo([carga], 1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(carga).not.toHaveBeenCalled();
    enLinea.mockRestore();
  });
});
