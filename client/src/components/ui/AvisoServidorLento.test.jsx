import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '../../test/render';
import AvisoServidorLento from './AvisoServidorLento';
import { AVISO_LENTO_MS, seguirPeticion } from '../../data/servidorLento';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('AvisoServidorLento', () => {
  it('BUG evitado: con el servidor dormido la app dice que se está despertando (antes parecía colgada) y lo quita al responder', async () => {
    render(<AvisoServidorLento />);
    expect(screen.queryByRole('status')).toBeNull();
    let responder;
    seguirPeticion(new Promise((r) => { responder = r; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(AVISO_LENTO_MS); });
    expect(screen.getByRole('status')).toHaveTextContent('Despertando el servidor');
    await act(async () => { responder(); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
