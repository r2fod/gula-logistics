import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/render';
import PublicView from './PublicView';

const semana = (extra = {}) => ({
  id: 'w1', name: 'Semana Uno', meta: { week: 'Semana Uno', dateRange: 'Del 13 al 18 de Octubre de 2026', status: 'Operativa Activa' },
  schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] }, ...extra,
});

describe('PublicView — flota', () => {
  it('enseña los camiones de la semana (los de Mongo)', () => {
    render(<PublicView data={semana({ trucks: [{ name: 'Camión Gula', tag: 'PROPIO' }, { name: 'Furgo Norte', tag: 'ALQUILER' }] })} />);
    expect(screen.getByText('Furgo Norte')).toBeInTheDocument();
    expect(screen.getByText('2 Unidades')).toBeInTheDocument();
  });

  it('BUG evitado: una semana sin flota no inventa camiones (antes, tres fijos con empresas de alquiler escritas en el código)', () => {
    render(<PublicView data={semana()} />);
    expect(screen.getByText('0 Unidades')).toBeInTheDocument();
    expect(screen.queryByText(/Camión/)).toBeNull();
  });
});
