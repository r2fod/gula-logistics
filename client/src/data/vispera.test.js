import { describe, it, expect } from 'vitest';
import { tareasDeLaVispera } from './vispera';

const hoy = new Date(2026, 8, 21, 20, 0);
const anterior = (tareas, status = 'Operativa Activa') => ({ name: 'Semana 3', meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status }, sundayMonday: { tasks: tareas } });
const actual = (events = [{ name: 'Evento Uno', pax: 50 }, { name: 'Boda Dos', pax: 100 }]) => ({ name: 'Semana 4', meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Operativa Activa' }, events });
const carga = { text: 'Evento Uno - Carga camión', timeFrame: '17:00-17:30', targetDay: 'Lunes', assigned: ['Ana'], completed: true };

describe('tareasDeLaVispera', () => {
  it('encuentra el lunes anterior con las tareas de la semana previa que sirven a los eventos de esta', () => {
    const semanas = { a: anterior([carga]), b: actual() };
    const v = tareasDeLaVispera(semanas, semanas.b, hoy);
    expect(v.fecha).toEqual(new Date(2026, 8, 21));
    expect(v.semana.name).toBe('Semana 3');
    expect(v.tareas).toEqual([{ task: carga, idx: 0 }]);
  });

  it('las devoluciones de la semana anterior (otros eventos o sin evento) no cuentan, ni las de domingo', () => {
    const devolucion = { text: 'Devolución material alquiler', targetDay: 'Lunes', assigned: ['Ana'] };
    const otroEvento = { text: 'Boda Vieja - Recogida', targetDay: 'Lunes', assigned: ['Ana'] };
    const domingo = { ...carga, targetDay: 'Domingo' };
    const semanas = { a: anterior([devolucion, otroEvento, domingo, carga]), b: actual() };
    expect(tareasDeLaVispera(semanas, semanas.b, hoy).tareas.map(t => t.idx)).toEqual([3]);
  });

  it('reconoce el evento por el campo `event` (semanas anteriores al formato "Evento - Tarea") y en tareas de varios eventos', () => {
    const anotada = { text: 'Cargar camión', event: 'Boda Dos', targetDay: 'Lunes', assigned: ['Ana'] };
    const varios = { text: 'Evento Uno + Boda Dos - Carga conjunta', targetDay: 'Lunes', assigned: ['Ana'] };
    const semanas = { a: anterior([anotada, varios]), b: actual() };
    expect(tareasDeLaVispera(semanas, semanas.b, hoy).tareas).toHaveLength(2);
  });

  it('null si la semana no tiene eventos, si no hay semana anterior legible, si es un borrador o si no hay tareas', () => {
    const semanas = { a: anterior([carga]), b: actual([]) };
    expect(tareasDeLaVispera(semanas, semanas.b, hoy)).toBeNull(); // sin eventos no hay con qué enlazar
    expect(tareasDeLaVispera({ b: actual() }, actual(), hoy)).toBeNull(); // sin semana anterior
    const conBorrador = { a: anterior([carga], 'Borrador'), b: actual() };
    expect(tareasDeLaVispera(conBorrador, conBorrador.b, hoy)).toBeNull();
    const sinTareas = { a: anterior([]), b: actual() };
    expect(tareasDeLaVispera(sinTareas, sinTareas.b, hoy)).toBeNull();
    expect(tareasDeLaVispera({ a: anterior([carga]) }, { name: 'X', meta: { dateRange: 'fechas raras' }, events: [{ name: 'Evento Uno' }] }, hoy)).toBeNull();
  });
});
