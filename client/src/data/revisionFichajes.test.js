import { describe, it, expect } from 'vitest';
import { revisarFichajes } from './revisionFichajes';

let n = 0;
const f = (workerName, type, hora, extra = {}) => ({ id: `f${++n}`, workerName, type, timestamp: new Date(`2026-09-20T${hora}`).toISOString(), taskName: 'JORNADA', ...extra });
const motivos = (r) => [...r.sobran, ...r.revisar].map(g => g.motivo);
const AHORA = new Date('2026-09-20T23:00:00');

describe('revisarFichajes', () => {
  it('turnos normales: nada que limpiar ni revisar', () => {
    const r = revisarFichajes([f('Ana', 'entrada', '08:00:00'), f('Ana', 'salida', '12:00:00'), f('Luis', 'entrada', '09:00:00'), f('Luis', 'salida', '10:00:00')], AHORA);
    expect(r).toEqual({ sobran: [], revisar: [] });
  });

  it('entrada tapada por otra, salida suelta y turno de menos de 15 min sobran (no cuentan)', () => {
    const tapada = f('Ana', 'entrada', '08:00:00');
    const suelta = f('Luis', 'salida', '09:00:00');
    const vacia = [f('Eva', 'entrada', '10:00:00'), f('Eva', 'salida', '10:00:06')];
    const r = revisarFichajes([tapada, f('Ana', 'entrada', '08:12:00'), f('Ana', 'salida', '12:00:00'), suelta, ...vacia], AHORA);
    expect(r.sobran.map(g => [g.motivo, g.fichajes.map(x => x.id)])).toEqual([
      ['entrada-tapada', [tapada.id]],
      ['salida-suelta', [suelta.id]],
      ['turno-vacio', vacia.map(x => x.id)],
    ]);
    expect(r.revisar).toEqual([]);
  });

  it('la misma tarea fichada dos veces seguidas: sobra la segunda', () => {
    const dobles = [f('Ana', 'fichaje', '09:00:00'), f('Ana', 'fichaje', '09:00:01')];
    const r = revisarFichajes([f('Ana', 'entrada', '08:00:00'), ...dobles, f('Ana', 'salida', '12:00:00')], AHORA);
    expect(r.sobran).toHaveLength(1);
    expect(r.sobran[0].fichajes[0].id).toBe(dobles[1].id);
  });

  it('turno de más de 14 h y entrada olvidada se revisan (cuentan, no se borran)', () => {
    const r = revisarFichajes([f('Ana', 'entrada', '04:30:00'), f('Ana', 'salida', '23:30:00'), { ...f('Luis', 'entrada', '00:00:00'), timestamp: new Date('2026-09-19T05:00:00').toISOString() }], AHORA);
    expect(r.sobran).toEqual([]);
    expect(motivos(r)).toEqual(['turno-largo', 'olvidado']);
  });

  it('empareja como pairShiftsFromEntries (sin mirar mayúsculas) e ignora la papelera', () => {
    const r = revisarFichajes([f('Eva', 'entrada', '08:00:00'), f('eva', 'salida', '12:00:00'), f('Ana', 'salida', '13:00:00', { deleted: true })], AHORA);
    expect(r).toEqual({ sobran: [], revisar: [] });
  });
});
