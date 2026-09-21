import { describe, it, expect } from 'vitest';
import { summarizeByEvent } from './eventSummary';
import { buildTaskEventResolver, buildTaskContextResolver } from './eventNaming';

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
      turno('Ana', [sub('Boda Ana y Luis y Boda Marta', 3, 30), sub('Boda Marta', 1, 10)]),
      turno('Luis', [sub('Logística Carga', 2, 20)]),
    ], roster);
    expect(lista.reduce((a, e) => a + e.totalCost, 0)).toBeCloseTo(60);
    expect(lista.reduce((a, e) => a + e.totalHours, 0)).toBeCloseTo(6);
    const marta = lista.find(e => e.eventName === 'Boda Marta');
    expect(marta.totalCost).toBeCloseTo(25); // 15 de la tarea compartida + 10 propios
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

describe('summarizeByEvent — reparto por pax', () => {
  it('una boda de 150 pax y otra de 50 se reparten 75% / 25% de una tarea compartida', () => {
    const lista = summarizeByEvent(
      [turno('Ana', [sub('Boda Grande + Boda Pequeña', 2, 20)])],
      roster,
      { 'boda grande': 150, 'boda pequeña': 50 }
    );
    const grande = lista.find(e => e.eventName === 'Boda Grande');
    const pequena = lista.find(e => e.eventName === 'Boda Pequeña');
    expect(grande).toMatchObject({ totalCost: 15, totalHours: 1.5, pax: 150 });
    expect(pequena).toMatchObject({ totalCost: 5, totalHours: 0.5, pax: 50 });
    expect(grande.workers.Ana.cost).toBe(15);
  });

  it('con un solo pax anotado se reparte a partes iguales, y los totales siempre cuadran', () => {
    const lista = summarizeByEvent([turno('Ana', [sub('Boda A + Boda B', 2, 20)])], roster, { 'boda a': 100 });
    expect(lista.map(e => e.totalCost)).toEqual([10, 10]);
    expect(lista.reduce((a, e) => a + e.totalCost, 0)).toBe(20);
  });
});

describe('summarizeByEvent — evento del planning', () => {
  const semanas = { w: { schedule: { martes: { tasks: [{ text: 'Descarga Finca Sur — recogida de material', event: 'Boda Marta' }] } } } };
  const resolver = buildTaskEventResolver(semanas);

  it('un fichaje con el texto de una tarea anotada va al evento del planning y los totales no cambian', () => {
    const turnos = [turno('Ana', [
      { taskName: 'Descarga Finca Sur — recogida de material (10:30-16:00)', eventName: 'Logística Preparación', durationHours: 4, cost: 40 },
      { taskName: 'Tarea suelta', eventName: 'Tarea suelta', durationHours: 1, cost: 10 },
    ])];
    const sin = summarizeByEvent(turnos, roster);
    const con = summarizeByEvent(turnos, roster, {}, resolver);

    expect(sin.map(e => e.eventName).sort()).toEqual(['Logística Preparación', 'Tarea suelta']);
    expect(con.map(e => e.eventName).sort()).toEqual(['Boda Marta', 'Tarea suelta']);
    expect(con.reduce((a, e) => a + e.totalCost, 0)).toBe(sin.reduce((a, e) => a + e.totalCost, 0));
  });
});

describe('summarizeByEvent — reparto con los pax de la semana de la tarea', () => {
  it('una tarea de dos eventos se reparte con los pax de SU semana aunque otra semana tenga el mismo evento con otro tamaño', () => {
    const semanas = {
      w3: { events: [{ name: 'Boda A', pax: 150 }, { name: 'Boda B', pax: 50 }], schedule: { martes: { tasks: [{ text: 'Recoger material', event: 'Boda A + Boda B' }] } } },
      w4: { events: [{ name: 'Boda A', pax: 10 }] }, // misma boda "A" en otra semana, muy distinta
    };
    const lista = summarizeByEvent(
      [turno('Ana', [{ taskName: 'Recoger material', eventName: 'Logística Preparación', durationHours: 2, cost: 20 }])],
      roster, {}, buildTaskContextResolver(semanas)
    );
    expect(lista.find(e => e.eventName === 'Boda A').totalCost).toBe(15); // 150/(150+50), no 10/(10+50)
    expect(lista.find(e => e.eventName === 'Boda B').totalCost).toBe(5);
  });
});
