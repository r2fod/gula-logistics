import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/render';
import HistorialFichajes from './HistorialFichajes';

const fichaje = (id) => ({ id, workerName: 'Ana', type: 'entrada', timestamp: new Date(2026, 9, 14, 9).toISOString(), taskName: 'JORNADA' });

describe('HistorialFichajes', () => {
  it('BUG evitado: con uno solo dice «1 fichaje enviado» (antes «1 fichajes enviados»)', () => {
    render(<HistorialFichajes fichajes={[fichaje('a')]} onAnadir={() => {}} />);
    expect(screen.getByText('1 fichaje enviado')).toBeInTheDocument();
  });

  it('con varios, en plural', () => {
    render(<HistorialFichajes fichajes={[fichaje('a'), fichaje('b')]} onAnadir={() => {}} />);
    expect(screen.getByText('2 fichajes enviados')).toBeInTheDocument();
  });

  it('BUG evitado: la tabla de escritorio muestra la duración del turno de salida igual que las tarjetas móviles', () => {
    const salida = { id: 's1', workerName: 'Ana', type: 'salida', timestamp: new Date(2026, 9, 14, 13, 30).toISOString(), taskName: 'JORNADA' };
    render(<HistorialFichajes fichajes={[salida]} duracionDeSalida={new Map([['s1', 4.5]])} onAnadir={() => {}} />);
    const tabla = screen.getByRole('table');
    expect(tabla.textContent).toContain('Duración');
    expect(tabla.textContent).toMatch(/4,5\s+h/);
  });
});
