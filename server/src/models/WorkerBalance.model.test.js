import { describe, it, expect } from 'vitest';
import { WorkerBalance } from './WorkerBalance.model.js';

describe('WorkerBalance', () => {
  it('guarda los meses del acuerdo de bolsa y las horas de bolsa de un turno a mano (Mongoose tira lo que el esquema no declara)', () => {
    const doc = new WorkerBalance({
      id: 'eva', name: 'Eva', isSpecialPurse: true,
      purseInfo: { totalHours: 10, hourlyRate: 8, extraRateAfter80h: 12, desde: '2026-09', hasta: '2026-10' },
      breakdown: [{ concept: 'turno a mano', amount: 24, date: '2026-10-02', tipo: 'turno', horasBolsa: 3 }],
    }).toObject();
    expect(doc.purseInfo).toMatchObject({ desde: '2026-09', hasta: '2026-10' });
    expect(doc.breakdown[0].horasBolsa).toBe(3);
  });
});
