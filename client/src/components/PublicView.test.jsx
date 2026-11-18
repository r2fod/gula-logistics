import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../test/render';
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

  it('BUG evitado: en móvil ofrece pestaña «Equipo», y al elegir «Camiones» oculta el monitor en vivo y el equipo', () => {
    const equipo = [{ name: 'Ana', role: 'Conductora' }];
    render(<PublicView data={semana({ trucks: [{ name: 'Furgo Norte', tag: 'ALQUILER' }] })} workersList={equipo} />);
    const tabEquipo = screen.getByRole('button', { name: /Equipo/ });
    expect(tabEquipo).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Camiones \(1\)/ }));
    expect(screen.queryByText(/Monitor de Actividad en Tiempo Real/)).toBeNull();
    expect(screen.queryByText(/Equipo & Roles Asignados/)).toBeNull();
    fireEvent.click(tabEquipo);
    expect(screen.getByText(/Equipo & Roles Asignados/)).toBeInTheDocument();
    expect(screen.queryByText('Furgo Norte')).toBeNull();
  });

  it('BUG evitado: buscar a alguien inexistente en el equipo muestra estado vacío y botón para limpiar', () => {
    render(<PublicView data={semana()} workersList={[{ name: 'Ana', role: 'Conductora' }]} />);
    const input = screen.getByPlaceholderText(/Buscar rol o persona/);
    fireEvent.change(input, { target: { value: 'NadieConEsteNombre' } });
    expect(screen.getByText(/No hay coincidencias/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Limpiar búsqueda/i }));
    expect(input.value).toBe('');
  });
});
