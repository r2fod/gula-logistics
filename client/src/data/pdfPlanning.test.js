import { describe, it, expect } from 'vitest';
import { datosDelPdf, nombreDelPdf } from './pdfPlanning';

const semana = () => ({
  meta: { week: 'Semana de prueba', dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Operativa Activa' },
  events: [{ name: 'Boda Ana', pax: 120 }, { name: 'boda ana', pax: 120 }, { name: 'Cena Luis', pax: 40 }, { name: 'Sin pax' }],
  schedule: {
    martes: { tasks: [
      { id: 'm2', text: 'Boda Ana - Carga de mesas', timeFrame: '10:00 - 12:30', assigned: ['Ana', 'Luis'], truck: 'Camión 1', location: 'Almacén' },
      { id: 'm1', text: 'Boda Ana - Montaje', timeFrame: '08:00 - 10:00', assigned: ['Eva'], completed: true },
      { id: 'm3', text: 'Desactivada', timeFrame: '09:00 - 10:00', assigned: ['Eva'], active: false },
    ] },
    miercoles: { tasks: [] },
    jueves: { tasks: [{ id: 'j1', text: 'Limpieza general', timeFrame: '', assigned: [] }] },
    viernes: { tasks: [] },
  },
  saturdaySpecial: { weddings: [
    { location: 'Finca Norte', truck: 'Camión 2', details: 'Boda Eva — Montaje y servicio', timeFrame: '09:00 - 17:00', assigned: ['Ana'] },
    { location: 'Finca Sur', event: 'Boda Luis', details: '', timeFrame: '10:00 - 12:00', assigned: [] },
  ] },
  sundayMonday: { tasks: [
    { id: 'sl1', text: 'Cena Luis - Recogida', timeFrame: '09:00 - 11:00', targetDay: 'Domingo', assigned: ['luis'] },
    { id: 'sl2', text: 'Cena Luis - Vajilla', timeFrame: '09:00 - 10:00', assigned: ['Ana'] },
  ] },
});

describe('datosDelPdf', () => {
  it('cabecera, eventos sin repetir y totales', () => {
    const d = datosDelPdf(semana(), [{ name: 'Luis' }]);
    expect(d.cabecera).toEqual({ semana: 'Semana de prueba', rango: 'Del 15 al 20 de Septiembre de 2026', estado: 'Operativa Activa' });
    expect(d.eventos).toEqual([{ nombre: 'Boda Ana', pax: 120 }, { nombre: 'Cena Luis', pax: 40 }, { nombre: 'Sin pax', pax: null }]);
    expect(d.totalTareas).toBe(7);
  });

  it('días en orden con su fecha real; salta los vacíos y las tareas desactivadas', () => {
    const d = datosDelPdf(semana());
    expect(d.dias.map((x) => x.clave)).toEqual(['martes', 'jueves', 'sabado', 'domingo', 'lunes']);
    expect(d.dias.map((x) => x.titulo)).toEqual(['Martes 15', 'Jueves 17', 'Sábado 19', 'Domingo 20', 'Lunes 21']);
    expect(d.dias[0].tareas).toHaveLength(2);
  });

  it('tareas por hora de inicio, con evento, tarea, equipo, vehículo, lugar y hecha', () => {
    const [martes] = datosDelPdf(semana()).dias;
    expect(martes.tareas.map((t) => t.hora)).toEqual(['08:00 - 10:00', '10:00 - 12:30']);
    expect(martes.tareas[0]).toMatchObject({ evento: 'Boda Ana', tarea: 'Montaje', equipo: ['Eva'], hecha: true });
    expect(martes.tareas[1]).toMatchObject({ evento: 'Boda Ana', tarea: 'Carga de mesas', equipo: ['Ana', 'Luis'], vehiculo: 'Camión 1', lugar: 'Almacén', hecha: false });
  });

  it('una tarea sin evento ni hora sale con su texto entero y al final', () => {
    const jueves = datosDelPdf(semana()).dias.find((x) => x.clave === 'jueves');
    expect(jueves.tareas[0]).toMatchObject({ evento: '', tarea: 'Limpieza general', hora: '' });
  });

  it('sábado: el evento sale de `event` o de `details` antes de « — »', () => {
    const sabado = datosDelPdf(semana()).dias.find((x) => x.clave === 'sabado');
    expect(sabado.tareas[0]).toMatchObject({ evento: 'Boda Eva', tarea: 'Montaje y servicio', lugar: 'Finca Norte', vehiculo: 'Camión 2' });
    expect(sabado.tareas[1]).toMatchObject({ evento: 'Boda Luis', lugar: 'Finca Sur' });
  });

  it('domingo y lunes se separan por targetDay; sin él cuenta como lunes', () => {
    const d = datosDelPdf(semana());
    expect(d.dias.find((x) => x.clave === 'domingo').tareas.map((t) => t.tarea)).toEqual(['Recogida']);
    expect(d.dias.find((x) => x.clave === 'lunes').tareas.map((t) => t.tarea)).toEqual(['Vajilla']);
  });

  it('resumen por persona: tareas y horas, de más a menos; mismo nombre con otra mayúscula es la misma persona', () => {
    const { resumen } = datosDelPdf(semana(), [{ name: 'Luis' }]);
    expect(resumen).toEqual([
      { nombre: 'Ana', tareas: 3, horas: 11.5 },
      { nombre: 'Luis', tareas: 2, horas: 4.5 },
      { nombre: 'Eva', tareas: 1, horas: 2 },
    ]);
  });

  it('avisa de las tareas sin nadie asignado', () => {
    const { sinAsignar } = datosDelPdf(semana());
    expect(sinAsignar.map((s) => s.texto)).toEqual(['Limpieza general', 'Boda Luis - Boda']);
    expect(sinAsignar[0]).toMatchObject({ dia: 'Jueves 17' });
  });

  it('una semana vacía o rota no revienta', () => {
    expect(datosDelPdf(null).totalTareas).toBe(0);
    expect(datosDelPdf({}).dias).toEqual([]);
  });
});

describe('nombreDelPdf', () => {
  it('Planning <semana> (<rango>).pdf', () => {
    expect(nombreDelPdf(semana())).toBe('Planning Semana de prueba (Del 15 al 20 de Septiembre de 2026).pdf');
  });

  it('quita los caracteres que un sistema de archivos no admite', () => {
    expect(nombreDelPdf({ meta: { week: 'Semana 4/5: "fin"', dateRange: '' } })).toBe('Planning Semana 4 5 fin.pdf');
  });
});
