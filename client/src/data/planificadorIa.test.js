import { describe, it, expect } from 'vitest';
import {
  semanaParaPrompt, semanaVacia, nombresPermitidos, esquemaPlan,
  completarPlanGenerado, contextoParaPrompt, promptCorreccion,
} from './planificadorIa';
import { normalizarHorario } from './horarios';

const equipo = [
  { name: 'Ana', role: 'Conductora', rate: 37, isPayroll: false },
  { name: 'Luis', role: 'Apoyo logística', rate: 10, isPayroll: false },
  { name: 'Eva', role: 'Limpieza', rate: 10, isPayroll: true },
];

const semana = () => ({
  meta: { week: 'Semana 9', dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Borrador' },
  trucks: [{ name: 'Camión Norte', status: 'ok', tag: 'Propio' }],
  events: [{ name: 'Boda Uno', pax: 120 }],
  schedule: {
    martes: { title: 'Martes', badge: 'Carga', tasks: [
      { id: 'm1', text: 'Boda Uno - Carga', location: 'Almacén Base', timeFrame: '09:00 - 11:00', assigned: ['Ana'], completed: true, completedAt: '2026-09-22T11:00:00.000Z', mapsUrl: '' },
      { id: 'm2', text: 'Logística Preparación - Recoger mesas', location: 'Alquileres Sur', timeFrame: '12:00 - 13:00', assigned: ['Luis'], phone: '600000000', mapsUrl: 'https://maps/sur' },
      { id: 'm3', text: 'Logística Carga - Tarea apagada', timeFrame: '15:00 - 16:00', assigned: ['Luis'], active: false },
    ] },
    miercoles: { title: 'Miércoles', badge: 'x', tasks: [] },
    jueves: { title: 'Jueves', badge: 'x', tasks: [] },
    viernes: { title: 'Viernes', badge: 'x', tasks: [] },
  },
  saturdaySpecial: { title: 'Sábado', weddings: [{ location: 'Finca Norte', truck: 'Camión Norte', details: 'Montaje', timeFrame: '10:00 - 02:00', assigned: ['Ana', 'Luis'], phone: '611111111', mapsUrl: 'https://maps/finca' }] },
  sundayMonday: { title: 'Cola', tasks: [{ id: 'sl1', text: 'Limpieza Eventos - Vajilla', timeFrame: '10:00 - 13:00', assigned: ['Eva'], targetDay: 'Lunes' }] },
});

describe('semanaParaPrompt', () => {
  it('BUG evitado: ni teléfonos ni enlaces de Maps ni fechas de hecha van a Google', () => {
    const texto = JSON.stringify(semanaParaPrompt(semana()));
    expect(texto).not.toMatch(/600000000|611111111|maps|completedAt/);
  });

  it('solo tareas activas; las hechas van marcadas para que no las toque', () => {
    const plan = semanaParaPrompt(semana());
    expect(plan.schedule.martes.tasks.map(t => t.id)).toEqual(['m1', 'm2']);
    expect(plan.schedule.martes.tasks[0].completed).toBe(true);
    expect(plan.schedule.martes.tasks[1].completed).toBeUndefined();
    expect(plan.sundayMonday.tasks[0].targetDay).toBe('Lunes');
    expect(plan.saturdaySpecial.weddings[0]).toMatchObject({ location: 'Finca Norte', truck: 'Camión Norte' });
  });

  it('es mucho más corta que la semana entera', () => {
    expect(JSON.stringify(semanaParaPrompt(semana())).length).toBeLessThan(JSON.stringify(semana(), null, 2).length / 2);
  });

  it('semana nueva: nada', () => {
    expect(semanaParaPrompt(null)).toBeNull();
    expect(semanaVacia(semanaParaPrompt({ schedule: {} }))).toBe(true);
    expect(semanaVacia(semanaParaPrompt(semana()))).toBe(false);
  });
});

describe('esquemaPlan y nombresPermitidos', () => {
  it('assigned solo admite los nombres permitidos', () => {
    const esquema = esquemaPlan(['Ana', 'Luis']);
    const tarea = esquema.properties.schedule.properties.martes.properties.tasks.items;
    expect(tarea.properties.assigned.items.enum).toEqual(['Ana', 'Luis']);
    expect(esquema.properties.sundayMonday.properties.tasks.items.properties.targetDay.enum).toEqual(['Domingo', 'Lunes']);
    expect(esquema.properties.saturdaySpecial.properties.weddings.items.properties.assigned.items.enum).toEqual(['Ana', 'Luis']);
  });

  it('sin nombres no pone una lista vacía (Gemini la rechazaría)', () => {
    const tarea = esquemaPlan([]).properties.schedule.properties.martes.properties.tasks.items;
    expect(tarea.properties.assigned.items.enum).toBeUndefined();
  });

  it('los disponibles mandan; si no hay, todo el equipo; y siempre quien ya está asignado', () => {
    expect(nombresPermitidos({ equipo, disponibles: ['Ana'] })).toEqual(['Ana']);
    expect(nombresPermitidos({ equipo })).toEqual(['Ana', 'Luis', 'Eva']);
    const s = semana();
    s.schedule.miercoles.tasks.push({ text: 'x', assigned: ['Persona Antigua'] });
    expect(nombresPermitidos({ equipo, semana: s })).toContain('Persona Antigua');
  });
});

describe('normalizarHorario', () => {
  it('deja todos los horarios como "HH:MM - HH:MM"', () => {
    expect(normalizarHorario('9:00-11:30')).toBe('09:00 - 11:30');
    expect(normalizarHorario('09.00 a 11.30')).toBe('09:00 - 11:30');
    expect(normalizarHorario('20:30 – 2:00')).toBe('20:30 - 02:00');
    expect(normalizarHorario('por la mañana')).toBe('por la mañana');
  });
});

describe('completarPlanGenerado', () => {
  const propuesta = () => ({
    schedule: {
      martes: { tasks: [
        { id: 'm1', text: 'Boda Uno - Carga cambiada', timeFrame: '8:00-9:00', assigned: [] }, // hecha: no se toca
        { id: 'm2', text: 'Logística Preparación - Recoger mesas', location: 'Alquileres Sur', timeFrame: '12:30-13:30', assigned: ['luis'] },
        { id: 'm2', text: 'Logística Carga - Nueva tarea', location: 'Finca Norte', timeFrame: '14:00 - 15:00', assigned: ['ANA'] },
      ] },
      miercoles: { tasks: [{ text: 'Logística Preparación - Sin id', timeFrame: '09:00 - 10:00', assigned: ['Luis'] }] },
      jueves: { tasks: [] },
      viernes: { tasks: [] },
    },
    saturdaySpecial: { weddings: [{ location: 'Finca Norte', truck: 'Camión Norte', details: 'Montaje y cena', timeFrame: '10:00 - 02:00', assigned: ['Ana'] }] },
    sundayMonday: { tasks: [{ text: 'Limpieza Eventos - Vajilla', timeFrame: '10:00 - 14:00', assigned: ['Eva'], targetDay: 'domingo' }] },
  });

  it('BUG evitado: un nombre que Gemini devuelve se lleva a la persona que es, no a la primera que lo contenga ("Mariana" ya no pasa a "Ana")', () => {
    const p = propuesta();
    p.schedule.jueves.tasks = [{ text: 'Logística Carga - Otra', timeFrame: '09:00 - 10:00', assigned: ['mariana'] }];
    const r = completarPlanGenerado(p, { original: semana(), equipo: [...equipo, { name: 'Mariana', role: 'Apoyo logística' }] });
    expect(r.schedule.jueves.tasks.at(-1).assigned).toEqual(['Mariana']);
  });

  it('BUG evitado: una tarea HECHA no cambia ni se desmarca aunque Gemini la reescriba', () => {
    const r = completarPlanGenerado(propuesta(), { original: semana(), equipo });
    expect(r.schedule.martes.tasks[0]).toEqual(semana().schedule.martes.tasks[0]);
  });

  it('una hecha que Gemini no devuelve sigue ahí; las desactivadas también', () => {
    const p = propuesta();
    p.schedule.martes.tasks.shift();
    const r = completarPlanGenerado(p, { original: semana(), equipo });
    const ids = r.schedule.martes.tasks.map(t => t.id);
    expect(ids).toContain('m1');
    expect(r.schedule.martes.tasks.find(t => t.id === 'm3')).toMatchObject({ active: false, text: 'Logística Carga - Tarea apagada' });
  });

  it('conserva lo que Gemini no ve (teléfono), rehace Maps si cambia el lugar y pone nombres exactos', () => {
    const r = completarPlanGenerado(propuesta(), { original: semana(), equipo });
    const [, m2, nueva] = r.schedule.martes.tasks;
    expect(m2).toMatchObject({ id: 'm2', phone: '600000000', mapsUrl: 'https://maps/sur', assigned: ['Luis'], timeFrame: '12:30 - 13:30', completed: false });
    expect(nueva.assigned).toEqual(['Ana']);
    expect(nueva.mapsUrl).toBe('https://www.google.com/maps/search/?api=1&query=Finca+Norte');
    expect(r.saturdaySpecial.weddings[0]).toMatchObject({ phone: '611111111', details: 'Montaje y cena', assigned: ['Ana'] });
  });

  it('ids únicos por día: el repetido o el que falta recibe el siguiente libre, sin tocar los que ya existían', () => {
    const r = completarPlanGenerado(propuesta(), { original: semana(), equipo });
    const ids = r.schedule.martes.tasks.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 2)).toEqual(['m1', 'm2']);
    expect(ids).toContain('m3'); // la desactivada conserva el suyo
    expect(r.schedule.miercoles.tasks[0].id).toBe('mi1');
  });

  it('domingo/lunes con targetDay bien escrito; cabeceras de la semana original', () => {
    const r = completarPlanGenerado(propuesta(), { original: semana(), equipo });
    expect(r.sundayMonday.tasks[0]).toMatchObject({ targetDay: 'Domingo', id: 'sl1' });
    expect(r.schedule.martes).toMatchObject({ title: 'Martes', badge: 'Carga' });
    expect(r.saturdaySpecial.title).toBe('Sábado');
  });

  it('semana nueva: cabeceras de la semilla y nada hecho', () => {
    const r = completarPlanGenerado(propuesta(), { original: null, equipo });
    expect(r.schedule.miercoles).toMatchObject({ title: 'Miércoles', badge: 'Recogidas & Descarga Adelantada' });
    expect(r.schedule.martes.tasks.every(t => t.completed === false)).toBe(true);
    expect(r.sundayMonday.title).toMatch(/Domingo & Lunes/);
  });

  it('completa el formato "EVENTO - Tarea" si Gemini se lo salta', () => {
    const p = propuesta();
    p.schedule.jueves.tasks.push({ text: 'Descarga en Finca Norte', timeFrame: '10:00 - 12:00', assigned: ['Ana'] });
    const r = completarPlanGenerado(p, { original: semana(), equipo, eventNames: ['Boda Finca Norte'] });
    expect(r.schedule.jueves.tasks[0].text).toBe('Boda Finca Norte - Descarga en Finca Norte');
  });
});

describe('contextoParaPrompt', () => {
  it('días con su número, equipo con rol, no disponibles, camiones, eventos y carga', () => {
    const texto = contextoParaPrompt({ semana: semana(), equipo, disponibles: ['Ana', 'Luis'] });
    expect(texto).toMatch(/Martes 22, Miércoles 23, Jueves 24, Viernes 25, Sábado 26, Domingo 27, Lunes 28/);
    expect(texto).toMatch(/- Ana \(Conductora\)/);
    expect(texto).toMatch(/NO DISPONIBLES esta semana \(no los asignes\): Eva/);
    expect(texto).toMatch(/CAMIONES de la semana: Camión Norte/);
    expect(texto).toMatch(/Boda Uno \(120 pax\)/);
    expect(texto).toMatch(/HORAS YA PLANIFICADAS/);
  });

  it('BUG evitado: sin tarifas ni nóminas (no hacen falta para planificar)', () => {
    expect(contextoParaPrompt({ semana: semana(), equipo })).not.toMatch(/37|nómina|tarifa|€/i);
  });

  it('promptCorreccion lista los avisos', () => {
    expect(promptCorreccion(['Uno.', 'Dos.'])).toBe('Corrige SOLO estos problemas de la planificación, sin cambiar nada más:\n- Uno.\n- Dos.');
  });
});
