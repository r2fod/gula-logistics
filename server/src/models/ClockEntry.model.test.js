import { describe, it, expect } from 'vitest';
import { ClockEntry } from './ClockEntry.model.js';

describe('ClockEntry', () => {
  it('BUG evitado: el taskRef guarda weekId, taskId y taskText (Mongo los tiraba y la salida buscaba la tarea solo por índice)', () => {
    const taskRef = { dayKey: 'viernes', taskIndex: 2, weekId: 'week_1', taskId: 'v3', taskText: 'Boda - Carga' };
    const doc = new ClockEntry({ id: 'x', workerName: 'Ana', type: 'entrada', timestamp: new Date().toISOString(), taskRef });
    expect(doc.toObject().taskRef).toEqual(taskRef);
  });
});
