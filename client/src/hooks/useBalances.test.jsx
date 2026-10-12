import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '../test/render';

vi.mock('../data/apiService', () => ({
  saveWorkerBalanceToAPI: vi.fn().mockResolvedValue({}),
  hasRealBalancesData: (datos) => !!datos?.workers?.length,
}));

import { useBalances } from './useBalances';
import { saveWorkerBalanceToAPI } from '../data/apiService';

const equipo = [{ name: 'Ana' }, { name: 'Mariana' }, { name: 'Luis' }];
const fichas = [
  { id: 'ana-gula', name: 'Ana Gula', hourlyRate: 10, agreements: ['Extra a 10,00 € / hora (Por Defecto)'] },
  { id: 'mariana', name: 'Mariana', hourlyRate: 10, agreements: [] },
];
const montar = () => {
  localStorage.setItem('gula_balances_data_v1', JSON.stringify({ workers: fichas }));
  return renderHook(() => useBalances(equipo, vi.fn()));
};

describe('useBalances: la tarifa nueva de alguien del equipo', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('va a SU ficha de Saldos (tarifa y acuerdo), no a la de quien se llama parecido', () => {
    const { result } = montar();
    act(() => { result.current.handleTarifaEnSaldos('Ana', 12); });
    const cambios = { hourlyRate: 12, agreements: ['Extra a 12,00 € / hora'] };
    expect(saveWorkerBalanceToAPI).toHaveBeenCalledWith('ana-gula', cambios);
    expect(result.current.balancesData.workers).toEqual([{ ...fichas[0], ...cambios }, fichas[1]]);
  });

  it('quien aún no tiene ficha guardada no crea una a medias', () => {
    const { result } = montar();
    act(() => { result.current.handleTarifaEnSaldos('Luis', 12); });
    expect(saveWorkerBalanceToAPI).not.toHaveBeenCalled();
    expect(result.current.balancesData.workers).toEqual(fichas);
  });
});
