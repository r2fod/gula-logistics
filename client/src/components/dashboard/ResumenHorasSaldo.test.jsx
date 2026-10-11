import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../test/render';

const fetchMio = vi.fn();
const token = vi.fn();
const olvidar = vi.fn();
vi.mock('../../data/apiService', () => ({
  fetchMiSaldoFromAPI: (...a) => fetchMio(...a),
  tokenTrabajador: (...a) => token(...a),
  olvidarTokenTrabajador: (...a) => olvidar(...a),
}));
const { default: ResumenHorasSaldo } = await import('./ResumenHorasSaldo');
const { REFRESCO_SALDO_MS } = await import('../../hooks/useMiSaldo');

const equipo = [{ name: 'Ana', role: 'Conductora' }];
// Un turno cerrado de 6 h el martes 29 (misma semana y mes que "hoy", miércoles 30).
const cerrado = [
  { id: 'c1', workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 29, 8, 0).toISOString(), rate: 10 },
  { id: 'c2', workerName: 'Ana', type: 'salida', timestamp: new Date(2026, 8, 29, 14, 0).toISOString() },
];
const pintar = (props = {}) => render(<ResumenHorasSaldo nombre="Ana" equipo={equipo} fichajesDeTodo={cerrado} {...props} />);
const esperarRed = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 30, 12, 0));
  fetchMio.mockReset(); token.mockReset(); olvidar.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('ResumenHorasSaldo (vista del trabajador)', () => {
  it('con su enlace personal ve sus horas y lo que tiene pendiente de cobro', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 120 } });
    pintar();
    await esperarRed();
    expect(screen.getByText('semana').previousSibling.textContent).toMatch(/^6\s?h$/);
    expect(screen.getByText('septiembre').previousSibling.textContent).toMatch(/^6\s?h$/);
    expect(screen.getByText('Por cobrar')).toBeInTheDocument();
    expect(screen.getByText('+180,00 €')).toBeInTheDocument(); // 120 a mano + 6 h fichadas a 10 €/h
    expect(fetchMio).toHaveBeenCalledWith('firma.ana');
  });

  it('BUG evitado: un pago apuntado en Saldos le llega sin recargar (antes no veía nada)', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValueOnce({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 120 } })
      .mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 70 } });
    pintar({ fichajesDeTodo: [] });
    await esperarRed();
    expect(screen.getByText('+120,00 €')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_SALDO_MS); });
    expect(screen.getByText('+70,00 €')).toBeInTheDocument();
  });

  it('en turno, las horas y el dinero suben en directo', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 10, hourlyRate: 10 } });
    const turnoAbierto = { workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 8, 30, 10, 0).toISOString(), rate: 10 };
    pintar({ turnoAbierto });
    await esperarRed();
    expect(screen.getByText('+90,00 €')).toBeInTheDocument(); // 10 + 6 h cerradas + 2 h en curso, a 10 €/h
    expect(screen.getByText('semana').previousSibling.textContent).toMatch(/^8\s?h$/);
    expect(screen.getByText('septiembre').previousSibling.textContent).toMatch(/^8\s?h$/);
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60 * 1000); });
    expect(screen.getByText('+95,00 €')).toBeInTheDocument();
  });

  it('el mes es el natural: un turno del 31 de agosto no cuenta en septiembre (ni en esta semana)', async () => {
    token.mockReturnValue(null);
    const agosto = [
      { id: 'd1', workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 7, 31, 8, 0).toISOString() },
      { id: 'd2', workerName: 'Ana', type: 'salida', timestamp: new Date(2026, 7, 31, 12, 0).toISOString() },
    ];
    pintar({ fichajesDeTodo: [...cerrado, ...agosto] });
    await esperarRed();
    expect(screen.getByText('septiembre').previousSibling.textContent).toMatch(/^6\s?h$/);
    expect(screen.getByText('semana').previousSibling.textContent).toMatch(/^6\s?h$/);
  });

  it('sin enlace personal no enseña dinero y le dice cómo verlo; en nómina fija, tampoco euros', async () => {
    token.mockReturnValue(null);
    pintar();
    await esperarRed();
    expect(screen.queryByText('Por cobrar')).toBeNull();
    expect(screen.getByText(/pide tu enlace personal/)).toBeInTheDocument();
    expect(fetchMio).not.toHaveBeenCalled();
  });

  it('BUG evitado: con enlace pero sin ficha en el servidor (404) le dice qué pasa (antes, el hueco vacío)', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValue({ ok: false, status: 404 });
    pintar();
    await esperarRed();
    expect(screen.getByText(/no encontramos tu ficha de saldo/)).toBeInTheDocument();
    expect(screen.queryByText(/pide tu enlace personal/)).toBeNull();
  });

  it('con la app en segundo plano no pregunta; al volver, pregunta en el momento', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 120 } });
    pintar();
    await esperarRed();
    const oculta = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_SALDO_MS * 3); });
    expect(fetchMio).toHaveBeenCalledTimes(1);
    oculta.mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
    expect(fetchMio).toHaveBeenCalledTimes(2);
    oculta.mockRestore();
  });

  it('en nómina fija no enseña euros aunque tenga enlace', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 0, statusType: 'payroll' } });
    pintar({ enNomina: true });
    await esperarRed();
    expect(screen.queryByText(/€/)).toBeNull();
  });

  it('si en el móvil quedó la ficha de OTRA persona, no la enseña; un enlace anulado se olvida', async () => {
    token.mockReturnValue('firma.luis');
    fetchMio.mockResolvedValue({ ok: true, ficha: { id: 'luis', name: 'Luis', currentBalance: 999 } });
    pintar();
    await esperarRed();
    expect(screen.queryByText('+999,00 €')).toBeNull();

    fetchMio.mockResolvedValue({ ok: false, status: 404 });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_SALDO_MS); });
    expect(olvidar).not.toHaveBeenCalled(); // BUG evitado: un servidor a medio desplegar (404) no le borra el enlace

    fetchMio.mockResolvedValue({ ok: false, status: 401 });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESCO_SALDO_MS); });
    expect(olvidar).toHaveBeenCalled();
  });
});
