import { describe, it, expect } from 'vitest';
import { anadirAlPlanning, eventosQueFaltan, fechasParaCalendario, mismoEvento } from './actualizarDesdeCalendario';
import { tareasDelPlanning } from './optimizadorPlanning';

// Equipo y calendario FICTICIOS con la misma forma que los reales.
const EQUIPO = [
  { name: 'Bruno', role: 'Conductor Flota (Veterano)' },
  { name: 'Carlos', role: 'Conductor Flota (Veterano)' },
  { name: 'Diego', role: 'Conductor & Backup' },
  { name: 'Elena', role: 'Ayudante Logística / Prepara Eventos / Verifica Checklist' },
  { name: 'Rafael', role: 'Apoyo Logística & Prep' },
  { name: 'Lara', role: 'Gula Limpieza Eventos' },
  { name: 'Óscar', role: 'Jefe de Logística' },
];

// Semana del 6 al 11 de octubre con la boda del miércoles ya planificada.
const semana = () => ({
  id: 'week_1',
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026', status: 'Operativa Activa' },
  trucks: [{ name: 'Camión Gula' }],
  events: [{ name: 'Boda Ana y Luis', pax: 120 }],
  schedule: {
    martes: { title: 'Martes 6', tasks: [] },
    miercoles: {
      title: 'Miércoles 7',
      tasks: [
        { id: 'mi1', text: 'Boda Ana y Luis - Carga de material', timeFrame: '09:00 - 11:00', assigned: ['Bruno', 'Carlos'], event: 'Boda Ana y Luis', completed: true },
        { id: 'mi2', text: 'Boda Ana y Luis - Descarga + Montaje Estructura', timeFrame: '11:00 - 14:00', assigned: ['Bruno', 'Carlos'], event: 'Boda Ana y Luis' },
      ],
    },
    jueves: { title: 'Jueves 8', tasks: [] },
    viernes: { title: 'Viernes 9', tasks: [] },
  },
  saturdaySpecial: { title: 'Sábado 10', weddings: [] },
  sundayMonday: { title: 'Domingo 11 & Lunes 12', tasks: [] },
});

const APUNTES = [
  { id: '1', fecha: '2026-10-07', tipo: 'boda', titulo: 'Boda Ana y Luis', pax: 120, hora: '19:00' }, // ya está
  { id: '2', fecha: '2026-10-08', hasta: '2026-10-09', tipo: 'produccion', titulo: 'Produ Faro', pax: 40, hora: '13:00' },
  { id: '3', fecha: '2026-10-07', tipo: 'tarea', titulo: 'Visita técnica' }, // no es un evento
];
const AHORA = new Date(2026, 9, 5, 10);

describe('actualizar el planning desde el calendario', () => {
  it('encuentra lo que el calendario tiene y la semana no (la producción, cada día), y deja fuera lo que ya está', () => {
    const r = eventosQueFaltan(semana(), APUNTES, { equipo: EQUIPO, ahora: AHORA });
    expect(r.faltan.map(e => `${e.nombre}: ${e.fechas.join(', ')}`)).toEqual(['Produ Faro: 2026-10-08, 2026-10-09']);
    const [produ] = r.faltan;
    expect(produ.pax).toBe(40);
    expect(produ.tareas.map(t => `${t.dia} ${t.tarea.text}`)).toEqual(expect.arrayContaining([
      'jueves Produ Faro - Carga de material', 'viernes Produ Faro - Recogida y vuelta a base',
    ]));
    expect(produ.tareas.every(t => t.tarea.event === 'Produ Faro' || /Faro/.test(t.tarea.text))).toBe(true);
    expect(r.avisos.every(a => /Produ Faro/.test(a))).toBe(true); // solo avisos de lo propuesto
  });

  it('una producción que ya tiene su día en el planning solo propone los días que faltan', () => {
    const s = semana();
    s.schedule.jueves.tasks.push({ id: 'j1', text: 'Produ Faro - Carga de material', timeFrame: '10:00 - 11:00', assigned: [], event: 'Produ Faro' });
    const r = eventosQueFaltan(s, APUNTES, { equipo: EQUIPO, ahora: AHORA });
    expect(r.faltan.map(e => e.fechas)).toEqual([['2026-10-09']]);
    expect(r.faltan[0].tareas.some(t => t.dia === 'jueves')).toBe(false); // ese día ya está
    expect(r.faltan[0].tareas.filter(t => t.dia === 'viernes').length).toBeGreaterThan(0);
  });

  it('nombres parecidos cuentan como el mismo evento; distintos, no', () => {
    expect(mismoEvento('Boda Ana', 'Boda Ana y Luis')).toBe(true);
    expect(mismoEvento('Ana y Luis', 'Boda Ana y Luis')).toBe(true);
    expect(mismoEvento('Evento Eva y Pau Casa en Olmo?', 'Evento Eva y Pau Casa en Olmo')).toBe(true);
    expect(mismoEvento('Boda Ana y Luis', 'Boda Eva y Pau')).toBe(false);
    expect(mismoEvento('', 'Boda Ana')).toBe(false);
  });

  it('sin nada nuevo en el calendario, nada que añadir; sin fechas legibles, error', () => {
    expect(eventosQueFaltan(semana(), APUNTES.slice(0, 1), { equipo: EQUIPO, ahora: AHORA })).toEqual({ faltan: [], avisos: [] });
    expect(eventosQueFaltan({ meta: { dateRange: '' } }, APUNTES, { ahora: AHORA }).error).toMatch(/fechas/);
  });

  it('las tareas nuevas no ponen a nadie a la vez que en lo que ya tiene asignado', () => {
    const s = semana();
    // Todo el equipo de carga ocupado el jueves por la mañana en otra tarea ya planificada.
    s.schedule.jueves.tasks.push({ id: 'j1', text: 'Logística Preparación - Inventario', timeFrame: '07:00 - 15:00', assigned: ['Bruno', 'Carlos', 'Diego', 'Rafael'] });
    const { faltan } = eventosQueFaltan(s, APUNTES, { equipo: EQUIPO, ahora: AHORA });
    const delJuevesPorLaManana = faltan[0].tareas.filter(t => t.dia === 'jueves' && t.tarea.timeFrame < '15:00');
    expect(delJuevesPorLaManana.length).toBeGreaterThan(0);
    delJuevesPorLaManana.forEach(t => expect(t.tarea.assigned.some(p => ['Bruno', 'Carlos', 'Diego', 'Rafael'].includes(p))).toBe(false));
  });

  it('añadir NO toca lo que ya había (texto, gente, posición) y pone ids libres y el pax', () => {
    const base = semana();
    const { faltan } = eventosQueFaltan(base, APUNTES, { equipo: EQUIPO, ahora: AHORA });
    const nueva = anadirAlPlanning(base, faltan[0].tareas, faltan);
    expect(nueva.schedule.miercoles.tasks.slice(0, 2)).toEqual(base.schedule.miercoles.tasks);
    expect(base.schedule.jueves.tasks).toEqual([]); // la original no cambia
    const ids = nueva.schedule.jueves.tasks.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id).toMatch(/^j\d+$/));
    expect(nueva.events).toEqual([{ name: 'Boda Ana y Luis', pax: 120 }, { name: 'Produ Faro', pax: 40 }]);
    expect(nueva.meta).toEqual(base.meta);
    // Lo que había conserva su gente.
    const antes = tareasDelPlanning(base);
    const despues = tareasDelPlanning(nueva);
    antes.forEach(t => expect(despues.find(d => d.clave === t.clave).asignados).toEqual(t.asignados));
  });

  it('un id ya usado en el día no se repite', () => {
    const s = semana();
    s.schedule.jueves.tasks = [{ id: 'j2', text: 'Logística Carga - X', timeFrame: '07:00 - 08:00', assigned: [] }];
    const nueva = anadirAlPlanning(s, [{ lista: 'jueves', tarea: { id: 'j1', text: 'Produ Faro - Carga de material' } }, { lista: 'jueves', tarea: { id: 'j2', text: 'Produ Faro - Descarga' } }]);
    expect(nueva.schedule.jueves.tasks.map(t => t.id)).toEqual(['j2', 'j3', 'j4']);
  });

  it('pide el calendario de martes a lunes (la cola)', () => {
    expect(fechasParaCalendario(semana(), AHORA)).toEqual({ desde: '2026-10-06', hasta: '2026-10-12' });
    expect(fechasParaCalendario({ meta: {} }, AHORA)).toBeNull();
  });
});
