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
});
