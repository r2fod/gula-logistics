import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../data/apiService', () => ({
  fetchBalancesFromAPI: vi.fn().mockResolvedValue(null),
  saveWorkerBalanceToAPI: vi.fn().mockResolvedValue({}),
  getStoredAdminToken: () => null,
}));
vi.mock('../data/pushService', () => ({ sendPushNotification: vi.fn().mockResolvedValue({}) }));

import PartnerDashboardView from './PartnerDashboardView';
import { sendPushNotification } from '../data/pushService';

const semana = {
  id: 'week_3',
  name: 'Semana 3',
  meta: { week: 'Semana 3', dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Operativa Activa' },
  schedule: {},
  sundayMonday: { tasks: [] },
  saturdaySpecial: { weddings: [] },
  trucks: [],
};

const equipo = [
  { name: 'Ana', role: 'Conductora', avatar: '🚚', isPayroll: false },
  { name: 'Luis', role: 'Base', avatar: '👤', isPayroll: true },
];

const pintar = (extra = {}) => {
  const props = {
    activeWeekData: semana, allWeeks: { week_3: semana }, activeWeekId: 'week_3', onSelectWeek: vi.fn(),
    workersList: equipo, clockEntries: [], isAdmin: true,
    onOpenClockIn: vi.fn(), onOpenPayroll: vi.fn(), onOpenGemini: vi.fn(), onOpenShareModal: vi.fn(), onOpenAddWeek: vi.fn(),
    onOpenTaskEditor: vi.fn(), onOpenWorkerEditor: vi.fn(), onTogglePublicView: vi.fn(), onLogoutAdmin: vi.fn(), onOpenAdminLogin: vi.fn(),
    ...extra,
  };
  render(<PartnerDashboardView {...props} />);
  return props;
};

beforeEach(() => {
  window.history.replaceState({}, '', '/gula-logistics/');
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PartnerDashboardView', () => {
  it('abre en Actividad en Tiempo Real con la cabecera y las siete pestañas', async () => {
    pintar();
    expect(screen.getByRole('heading', { name: /Panel de Control Gula Logística/ })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(screen.getByRole('tab', { name: 'Actividad en Tiempo Real' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByText(/Monitor de Actividad en Tiempo Real/)).toBeInTheDocument());
  });

  it('cambiar de pestaña la muestra y la deja en la URL', async () => {
    pintar();
    fireEvent.click(screen.getByRole('tab', { name: 'Flota & Bodas' }));
    expect(screen.getByRole('tab', { name: 'Flota & Bodas' })).toHaveAttribute('aria-selected', 'true');
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('logistics');
  });

  it('respeta la pestaña que pide la URL', () => {
    window.history.replaceState({}, '', '/gula-logistics/?tab=grafo');
    pintar();
    expect(screen.getByRole('tab', { name: 'Grafo & Flujo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('las acciones de la barra llaman a sus funciones', () => {
    const props = pintar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fichar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Nóminas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gemini AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Planning' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trabajador' }));
    expect(props.onOpenClockIn).toHaveBeenCalled();
    expect(props.onOpenPayroll).toHaveBeenCalled();
    expect(props.onOpenGemini).toHaveBeenCalled();
    expect(props.onOpenTaskEditor).toHaveBeenCalled();
    expect(props.onOpenWorkerEditor).toHaveBeenCalled();
  });

  it('sin ser admin no aparecen las acciones de administración', () => {
    pintar({ isAdmin: false });
    expect(screen.queryByRole('button', { name: 'Nóminas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Avisar Cambios' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Admin Login' })).toBeInTheDocument();
  });

  it('el menú lateral trae las mismas acciones y se cierra al usarlas', () => {
    const props = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Menú' }));
    const menu = screen.getByRole('dialog', { name: 'Menú de Gestión' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Nóminas y Horas Extra' }));
    expect(props.onOpenPayroll).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Menú de Gestión' })).toBeNull();
  });

  it('salir cierra la sesión de admin y quita las acciones de administración', () => {
    const props = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(props.onLogoutAdmin).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Nóminas' })).toBeNull();
  });

  it('Avisar Cambios pide a quién y envía el aviso', async () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Avisar Cambios' }));
    const modal = screen.getByRole('dialog', { name: 'Avisar cambios' });
    fireEvent.click(within(modal).getByRole('button', { name: /Ana/ }));
    fireEvent.click(within(modal).getByRole('button', { name: 'Enviar Aviso' }));
    await waitFor(() => expect(sendPushNotification).toHaveBeenCalledWith(expect.any(String), expect.any(String), ['Ana']));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Avisar cambios' })).toBeNull());
    expect(window.alert).toHaveBeenCalledWith('Aviso enviado correctamente a 1 trabajador(es).');
  });

  it('"Clave" abre los ajustes de administrador', () => {
    pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Clave' }));
    expect(screen.getByText('Panel de Ajustes de Administrador')).toBeInTheDocument();
  });

  it('una semana en borrador enseña su aviso', () => {
    const borrador = { ...semana, meta: { ...semana.meta, status: 'Borrador' } };
    pintar({ activeWeekData: borrador, allWeeks: { week_3: borrador } });
    expect(screen.getByRole('button', { name: /Aceptar y activar/ })).toBeInTheDocument();
  });
});
