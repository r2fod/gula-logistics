import { describe, it, expect } from 'vitest';
import { summarizeByEvent } from './eventSummary';

const turno = (workerName, subTasks) => ({ workerName, subTasks });
const sub = (eventName, durationHours, cost) => ({ eventName, durationHours, cost });
const roster = [{ name: 'Ana', avatar: '🚚' }, { name: 'Luis', avatar: '📦' }];

describe('summarizeByEvent', () => {
  it('BUG evitado: una tarea de DOS eventos reparte horas y coste a partes iguales (no crea un tercer evento)', () => {
    const lista = summarizeByEvent([
      turno('Ana', [sub('Boda Ana y Luis + Boda Eva y Pau', 2, 20)]),
    ], roster);
    expect(lista.map(e => e.eventName).sort()).toEqual(['Boda Ana y Luis', 'Boda Eva y Pau']);
    lista.forEach(e => {
      expect(e.totalHours).toBe(1);
      expect(e.totalCost).toBe(10);
      expect(e.workers.Ana).toMatchObject({ hours: 1, cost: 10, avatar: '🚚' });
    });
  });

  it('los totales no cambian: la suma por evento es la del turno', () => {
    const lista = summarizeByEvent([
      turno('Ana', [sub('Boda Joaquín y Maria y Boda Rocio', 3, 30), sub('Boda Rocio', 1, 10)]),
      turno('Luis', [sub('Logística Carga', 2, 20)]),
    ], roster);
    expect(lista.reduce((a, e) => a + e.totalCost, 0)).toBeCloseTo(60);
    expect(lista.reduce((a, e) => a + e.totalHours, 0)).toBeCloseTo(6);
    const rocio = lista.find(e => e.eventName === 'Boda Rocio');
    expect(rocio.totalCost).toBeCloseTo(25); // 15 de la tarea compartida + 10 propios
  });

  it('agrupa sin distinguir mayúsculas y ordena por coste descendente', () => {
    const lista = summarizeByEvent([
      turno('Ana', [sub('Boda Sot', 1, 10), sub('boda sot', 1, 10), sub('Limpieza Eventos', 1, 50)]),
    ], roster);
    expect(lista.map(e => [e.eventName, e.totalCost])).toEqual([['Limpieza Eventos', 50], ['Boda Sot', 20]]);
  });

  it('sin evento va a "Sin Asignar / Extra"', () => {
    expect(summarizeByEvent([turno('Ana', [sub(undefined, 1, 10)])], roster)[0].eventName).toBe('Sin Asignar / Extra');
  });
});
