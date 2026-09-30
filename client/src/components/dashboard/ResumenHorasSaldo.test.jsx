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
const pintar = (props = {}) => render(<ResumenHorasSaldo nombre="Ana" horasSemana={6} equipo={equipo} {...props} />);
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
    expect(screen.getByText('Esta semana')).toBeInTheDocument();
    expect(screen.getByText(/^6\s?h$/)).toBeInTheDocument();
    expect(screen.getByText('Por cobrar')).toBeInTheDocument();
    expect(screen.getByText('+120,00 €')).toBeInTheDocument();
    expect(fetchMio).toHaveBeenCalledWith('firma.ana');
  });

  it('BUG evitado: un pago apuntado en Saldos le llega sin recargar (antes no veía nada)', async () => {
    token.mockReturnValue('firma.ana');
    fetchMio.mockResolvedValueOnce({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 120 } })
      .mockResolvedValue({ ok: true, ficha: { id: 'ana', name: 'Ana', currentBalance: 70 } });
    pintar();
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
    expect(screen.getByText('+30,00 €')).toBeInTheDocument(); // 10 + 2 h a 10 €/h
    expect(screen.getByText(/^8\s?h$/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60 * 1000); });
    expect(screen.getByText('+35,00 €')).toBeInTheDocument();
  });

  it('sin enlace personal no enseña dinero y le dice cómo verlo; en nómina fija, tampoco euros', async () => {
    token.mockReturnValue(null);
    pintar();
    await esperarRed();
    expect(screen.queryByText('Por cobrar')).toBeNull();
    expect(screen.getByText(/pide tu enlace personal/)).toBeInTheDocument();
    expect(fetchMio).not.toHaveBeenCalled();
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
