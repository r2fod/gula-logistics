import { describe, it, expect } from 'vitest';
import { festivosDeLaSemana, avisosDeFestivos, esRecadoAProveedor, pasarADiaHabil } from './festivosSemana';
import { comprobarSemana } from './checklistSemana';

// Semana del 6 al 11 de octubre de 2026: viernes 9 y lunes 12 (cola) son festivos.
const semana = (cambios = {}) => ({
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' },
  schedule: {
    martes: { tasks: [{ id: 'm1', text: 'Logística Preparación - Recoger mesas', timeFrame: '10:00 - 11:00', assigned: ['Ana'] }] },
    viernes: { tasks: [
      { id: 'v1', text: 'Logística Preparación - Recoger generador', timeFrame: '09:00 - 10:00', assigned: ['Ana'] },
      { id: 'v2', text: 'Boda Ana y Luis - Recogida y vuelta a base', timeFrame: '21:00 - 22:00', assigned: ['Ana'] },
    ] },
  },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [
    { id: 'sl1', text: 'Devolver sillas', targetDay: 'Lunes', timeFrame: '09:30 - 10:30', assigned: ['Ana'] },
    { id: 'sl2', text: 'Devolución generador', timeFrame: '11:00 - 12:00', assigned: ['Ana'] }, // sin día = lunes
    { id: 'sl3', text: 'Devolver hinchable', targetDay: 'Lunes', completed: true },
    { id: 'sl4', text: 'Devolver sofá', targetDay: 'Lunes', active: false },
    { id: 'sl5', text: 'Devolver camión', targetDay: 'Domingo', timeFrame: '00:45 - 01:30', assigned: ['Ana'] },
    { id: 'sl6', text: 'Limpieza Eventos - Vajilla', targetDay: 'Lunes', timeFrame: '12:00 - 14:00', assigned: ['Ana'] },
  ] },
  ...cambios,
});

describe('festivos dentro de una semana del planning', () => {
  it('BUG evitado: la devolución puesta el lunes de cola festivo se señala (los alquileres cierran)', () => {
    const [viernes, lunes] = festivosDeLaSemana(semana(), []);
    expect(viernes).toMatchObject({ dia: 'viernes', fecha: '2026-10-09', etiqueta: 'Viernes 9', nombre: 'Día de la Comunitat Valenciana', tareas: ['Recoger generador'] });
    // Solo los recados pendientes de ESE día: ni lo hecho, ni lo desactivado, ni lo del domingo, ni la limpieza.
    expect(lunes).toMatchObject({ dia: 'lunes', fecha: '2026-10-12', etiqueta: 'Lunes 12', nombre: 'Fiesta Nacional de España', tareas: ['Devolver sillas', 'Devolución generador'] });
  });

  it('recoger el propio evento no es un recado a un proveedor', () => {
    expect(esRecadoAProveedor('Boda Ana - Recogida y vuelta a base')).toBe(false);
    expect(esRecadoAProveedor('Recogida del evento (300 pax)')).toBe(false);
    expect(esRecadoAProveedor('Terminar de recoger en el sitio')).toBe(false);
    expect(esRecadoAProveedor('Devolución material alquiler')).toBe(true);
    expect(esRecadoAProveedor('recoger furgo')).toBe(true);
    expect(esRecadoAProveedor('Carga de material')).toBe(false);
  });

  it('una semana sin festivos, o sin fechas legibles, no dice nada; un festivo local sí cuenta', () => {
    const normal = semana({ meta: { dateRange: 'Del 13 al 18 de Octubre de 2026' } });
    expect(festivosDeLaSemana(normal, [])).toEqual([]);
    expect(festivosDeLaSemana({ meta: {} }, [])).toEqual([]);
    expect(festivosDeLaSemana(normal, [{ fecha: '2026-10-13', nombre: 'Fiesta local' }])[0]).toMatchObject({ dia: 'martes', local: true, tareas: ['Recoger mesas'] });
  });

  it('al aceptar un borrador sale entre lo que conviene mirar; un festivo sin recados no molesta', () => {
    expect(avisosDeFestivos(semana(), [])).toEqual([
      'Viernes 9 es festivo (Día de la Comunitat Valenciana) y los proveedores y alquileres cierran: revisa «Recoger generador».',
      'Lunes 12 es festivo (Fiesta Nacional de España) y los proveedores y alquileres cierran: revisa «Devolver sillas», «Devolución generador».',
    ]);
    expect(comprobarSemana(semana(), [{ name: 'Ana', role: 'Conductor' }], [])).toEqual(expect.arrayContaining([expect.stringMatching(/^Lunes 12 es festivo/)]));
    const sinRecados = semana({ sundayMonday: { tasks: [] } });
    sinRecados.schedule.viernes.tasks = [];
    expect(avisosDeFestivos(sinRecados, [])).toEqual([]);
  });
});

describe('pasar al día hábil una recogida o una devolución puesta en festivo', () => {
  const siguiente = () => ({
    name: 'Semana 7', meta: { dateRange: 'Del 13 al 18 de Octubre de 2026' },
    schedule: { martes: { title: 'Martes 13', tasks: [{ id: 'm1', text: 'Carga', assigned: ['Luis'] }] } },
    saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
  });
  const semanas = () => ({ week_6: { name: 'Semana 6', ...semana() }, week_7: siguiente() });

  it('cada recado dice a qué día se pasaría: la devolución, al siguiente que abren; la recogida, al anterior', () => {
    const [viernes, lunes] = festivosDeLaSemana(semana(), []);
    expect(viernes.recados).toEqual([{ texto: 'Recoger generador', indice: 0, destino: 'jueves 8' }]);
    expect(lunes.recados).toEqual([
      { texto: 'Devolver sillas', indice: 0, destino: 'martes 13' },
      { texto: 'Devolución generador', indice: 1, destino: 'martes 13' },
    ]);
  });

  it('BUG evitado: la devolución del lunes de cola festivo pasa al martes de la semana SIGUIENTE, con su gente y su hora', () => {
    const antes = semanas();
    const r = pasarADiaHabil(antes, 'week_6', 'lunes', 0, []);
    expect(r).toMatchObject({ destino: 'martes 13', semana: 'Semana 7' });
    expect(r.semanas.week_6.sundayMonday.tasks.map(t => t.id)).toEqual(['sl2', 'sl3', 'sl4', 'sl5', 'sl6']);
    expect(r.semanas.week_7.schedule.martes.tasks).toEqual([
      { id: 'm1', text: 'Carga', assigned: ['Luis'] },
      { id: 'm2', text: 'Devolver sillas', timeFrame: '09:30 - 10:30', assigned: ['Ana'], completed: false },
    ]);
    // No toca lo que había: ni el mapa de entrada ni las otras semanas.
    expect(antes.week_6.sundayMonday.tasks).toHaveLength(6);
    expect(antes.week_7.schedule.martes.tasks).toHaveLength(1);
  });

  it('dentro de la misma semana: la recogida del viernes festivo pasa al jueves', () => {
    const mapa = semanas();
    const r = pasarADiaHabil(mapa, 'week_6', 'viernes', 0, []);
    expect(r.destino).toBe('jueves 8');
    expect(r.semanas.week_6.schedule.viernes.tasks.map(t => t.id)).toEqual(['v2']);
    expect(r.semanas.week_6.schedule.jueves.tasks).toEqual([{ id: 'j1', text: 'Logística Preparación - Recoger generador', timeFrame: '09:00 - 10:00', assigned: ['Ana'], completed: false }]);
    expect(r.semanas.week_7).toBe(mapa.week_7); // la otra semana ni se toca (no se vuelve a guardar)
  });

  it('si la semana de destino no existe, lo dice y no cambia nada', () => {
    const solo = { week_6: semana() };
    const r = pasarADiaHabil(solo, 'week_6', 'lunes', 0, []);
    expect(r.error).toBe('No hay ninguna semana creada para el martes 13: créala primero («+ Semana») y vuelve a pulsarlo.');
    expect(r.semanas).toBeUndefined();
    expect(pasarADiaHabil(solo, 'week_6', 'lunes', 99, []).error).toMatch(/No se encuentra/);
    expect(pasarADiaHabil(solo, 'week_inexistente', 'lunes', 0, []).error).toMatch(/No se encuentra/);
  });
});

