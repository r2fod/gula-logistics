import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/render';
import PublicView from './PublicView';

vi.mock('./LiveMonitorPanel', () => ({ default: () => <p>Monitor en directo</p> }));

const semana = { meta: { dateRange: 'Del 6 al 11 de Octubre de 2026', week: 'Semana 6' }, trucks: [], schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } };

describe('Vista pública con los fichajes privados', () => {
  it('mientras son públicos (o aún no se sabe), enseña la actividad en directo', () => {
    render(<PublicView data={semana} workersList={[]} clockEntries={[]} lecturaFichajes="todos" />);
    expect(screen.getByText('Monitor en directo')).toBeInTheDocument();
  });

  it('BUG evitado: sin acceso no pinta el monitor vacío («nadie ha fichado»): dice que hace falta el enlace personal', () => {
    render(<PublicView data={semana} workersList={[]} clockEntries={[]} lecturaFichajes="ninguna" />);
    expect(screen.queryByText('Monitor en directo')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/Cada persona ve sus fichajes y sus horas con su enlace personal/);
  });
});
