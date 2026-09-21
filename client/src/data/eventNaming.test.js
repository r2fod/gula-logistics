import { describe, it, expect } from 'vitest';
import { parseEventAndTask, getEventName, inferCategory, buildEventName, normalizeGeneratedEvents, collectEventNames, splitEventNames, buildPaxRegistry, getEventShares, buildTaskEventResolver } from './eventNaming';

describe('parseEventAndTask', () => {
  it('"Evento - Tarea" explícito: separa por el guion normal', () => {
    expect(parseEventAndTask('Boda Ana y Luis - Descarga + Montaje Estructura'))
      .toEqual({ eventName: 'Boda Ana y Luis', specificTaskName: 'Descarga + Montaje Estructura', explicit: true });
  });

  it('BUG evitado: una raya larga con descripción NO es un evento (antes cada tarea era su "evento")', () => {
    const r = parseEventAndTask('Recoger Sillas Proveedor Sur — 90 sillas en jaula + jaula vacía.');
    expect(r.explicit).toBe(false);
    expect(r.eventName).toBe('Logística Preparación');
  });

  it('el horario entre paréntesis no se confunde con un guion', () => {
    expect(getEventName('Recogida Evento Delta y descarga en Restaurante (12:00-16:00)')).toBe('Logística Preparación');
    expect(getEventName('Boda Ana y Luis - Supervisión (09:00-11:00)')).toBe('Boda Ana y Luis');
  });

  it('fichaje de boda de sábado: Boda + primera parte del lugar, sin camión ni dirección', () => {
    expect(getEventName('Boda: El Mirador Este  (Camión Gula + Camion Albacar)')).toBe('Boda El Mirador Este');
    expect(getEventName('Boda: Camino Ejemplo, 1, 00000 Villa Ejemplo, España   (Camión Albacar (Alquiler))')).toBe('Boda Camino Ejemplo');
  });

  it('un texto que empieza por Boda/Evento usa ese nombre como evento', () => {
    expect(getEventName('Evento Zeta — logística completa, descarga y montaje de estructura + comida')).toBe('Evento Zeta');
    expect(getEventName('Boda Marta y Pedro, carga de material')).toBe('Boda Marta y Pedro');
  });

  it('categorías generales: limpieza, carga, y logística por defecto', () => {
    expect(inferCategory('Limpieza y recogida final del servicio')).toBe('Limpieza Eventos');
    expect(inferCategory('Carga de material — Camión Covey')).toBe('Logística Carga');
    expect(inferCategory('Descarga y montaje de estructura')).toBe('Logística Preparación'); // "descarga" no es "carga"
    expect(inferCategory('Devolución Alquileres Norte')).toBe('Logística Preparación');
    expect(inferCategory('Algo sin palabras clave')).toBeNull();
  });

  it('la jornada general va a Tareas Internas y un texto sin pistas se queda como su propio evento', () => {
    expect(getEventName('Inicio de Jornada')).toBe('Tareas Internas');
    expect(getEventName('Recoger Fulanita.')).toBe('Logística Preparación');
    expect(getEventName('Algo raro')).toBe('Algo raro');
    expect(getEventName('')).toBe('Sin Asignar');
  });
});

describe('buildEventName', () => {
  it('Tipo + lugar; sin lugar usa el día', () => {
    expect(buildEventName({ kind: 'Boda', place: ' Finca Norte ', day: 'viernes' })).toBe('Boda Finca Norte');
    expect(buildEventName({ kind: 'Evento', place: '', day: 'martes' }, (k) => `Martes 22`)).toBe('Evento del Martes 22');
  });
});

describe('normalizeGeneratedEvents', () => {
  const json = {
    schedule: {
      martes: { title: 'Martes', tasks: [
        { id: 'm1', text: 'Evento Catering Uno - Carga de material', assigned: ['Ana'] },
        { id: 'm2', text: 'Recoger generador para la Finca Norte', assigned: ['Luis'] },
        { id: 'm3', text: 'Limpieza de vajilla', assigned: ['Eva'] },
        { id: 'm4', text: 'Revisión de combustible', assigned: ['Luis'] },
      ] },
    },
    saturdaySpecial: { weddings: [{ location: 'Finca Norte' }] },
    sundayMonday: { tasks: [{ id: 's1', text: 'Devolución sofá', targetDay: 'Lunes' }] },
  };
  const out = normalizeGeneratedEvents(json, ['Boda Finca Norte', 'Evento Catering Uno']);
  const textos = out.schedule.martes.tasks.map(t => t.text);

  it('respeta el "Evento - Tarea" que ya trae la IA', () => {
    expect(textos[0]).toBe('Evento Catering Uno - Carga de material');
  });

  it('pone el evento conocido cuyo lugar aparece en el texto', () => {
    expect(textos[1]).toBe('Boda Finca Norte - Recoger generador para la Finca Norte');
  });

  it('sin evento conocido usa la categoría general que toca (y Logística Preparación por defecto)', () => {
    expect(textos[2]).toBe('Limpieza Eventos - Limpieza de vajilla');
    expect(textos[3]).toBe('Logística Preparación - Revisión de combustible');
    expect(out.sundayMonday.tasks[0].text).toBe('Logística Preparación - Devolución sofá');
  });

  it('conserva el resto de campos, las bodas del sábado y no muta la entrada', () => {
    expect(out.schedule.martes.tasks[0].assigned).toEqual(['Ana']);
    expect(out.sundayMonday.tasks[0].targetDay).toBe('Lunes');
    expect(out.saturdaySpecial).toEqual(json.saturdaySpecial);
    expect(json.schedule.martes.tasks[1].text).toBe('Recoger generador para la Finca Norte');
  });
});

describe('collectEventNames', () => {
  it('junta los eventos explícitos de la semana y las categorías, sin repetir', () => {
    const w = {
      schedule: { martes: { tasks: [{ text: 'Boda Ana y Luis - Carga' }, { text: 'Boda Ana y Luis - Supervisión' }, { text: 'Sin evento' }] } },
      sundayMonday: { tasks: [{ text: 'Evento Catering Uno - Devolución' }] },
    };
    const names = collectEventNames(w);
    expect(names).toEqual(expect.arrayContaining(['Boda Ana y Luis', 'Evento Catering Uno', 'Logística Preparación', 'Logística Carga', 'Limpieza Eventos']));
    expect(names.filter(n => n === 'Boda Ana y Luis')).toHaveLength(1);
    expect(names).not.toContain('Sin evento');
  });
});

describe('tareas de varios eventos', () => {
  it('splitEventNames: " + " separa; "y Boda"/"y Evento" también, pero no parte "Boda Ana y Luis"', () => {
    expect(splitEventNames('Boda Ana y Luis + Boda Eva y Pau')).toEqual(['Boda Ana y Luis', 'Boda Eva y Pau']);
    expect(splitEventNames('Boda Ana y Luis y Boda Marta')).toEqual(['Boda Ana y Luis', 'Boda Marta']);
    expect(splitEventNames('Evento Catering Uno y Evento Catering Dos')).toEqual(['Evento Catering Uno', 'Evento Catering Dos']);
    expect(splitEventNames('Boda Ana y Luis')).toEqual(['Boda Ana y Luis']);
    // un "+" dentro del nombre de UN evento no lo parte (viene así del calendario)
    expect(splitEventNames('Evento Coffee + Comida Omega')).toEqual(['Evento Coffee + Comida Omega']);
    expect(splitEventNames('Evento Coffee + Comida Omega + Evento Delta')).toEqual(['Evento Coffee + Comida Omega', 'Evento Delta']);
    expect(splitEventNames('')).toEqual([]);
  });

  it('"A + B - Tarea" se lee como un solo texto con dos eventos', () => {
    const r = parseEventAndTask('Boda Ana y Luis + Boda Eva y Pau - Recoger material Alquileres Norte');
    expect(r).toEqual({ eventName: 'Boda Ana y Luis + Boda Eva y Pau', specificTaskName: 'Recoger material Alquileres Norte', explicit: true });
    expect(splitEventNames(r.eventName)).toHaveLength(2);
  });

  it('collectEventNames sugiere cada evento suelto, no la combinación', () => {
    const w = { schedule: { martes: { tasks: [{ text: 'Boda Ana y Luis + Boda Eva y Pau - Recoger material' }] } } };
    const names = collectEventNames(w);
    expect(names).toEqual(expect.arrayContaining(['Boda Ana y Luis', 'Boda Eva y Pau']));
    expect(names).not.toContain('Boda Ana y Luis + Boda Eva y Pau');
  });

  it('normalizeGeneratedEvents une con " + " todos los eventos conocidos que nombra el texto', () => {
    const out = normalizeGeneratedEvents(
      { schedule: { martes: { tasks: [{ text: 'Recoger material Alquileres Norte Boda Ana y Luis y Boda Eva y Pau' }] } } },
      ['Boda Ana y Luis', 'Boda Eva y Pau', 'Boda Otra']
    );
    expect(out.schedule.martes.tasks[0].text).toBe('Boda Ana y Luis + Boda Eva y Pau - Recoger material Alquileres Norte Boda Ana y Luis y Boda Eva y Pau');
  });
});

describe('pax: buildPaxRegistry y getEventShares', () => {
  it('junta los pax de todas las semanas, sin distinguir mayúsculas y sin valores inválidos', () => {
    const reg = buildPaxRegistry({
      w1: { events: [{ name: 'Boda Ana y Luis', pax: 120 }, { name: 'Boda Sin Pax', pax: null }, { name: 'Boda Cero', pax: 0 }] },
      w2: { events: [{ name: ' Evento Catering ', pax: '80' }] },
      w3: {},
    });
    expect(reg).toEqual({ 'boda ana y luis': 120, 'evento catering': 80 });
    expect(buildPaxRegistry(null)).toEqual({});
  });

  it('un solo evento se lleva todo; varios se reparten por pax si TODOS lo tienen', () => {
    const reg = { 'boda a': 150, 'boda b': 50 };
    expect(getEventShares(['Boda A'], reg)).toEqual([1]);
    expect(getEventShares(['Boda A', 'Boda B'], reg)).toEqual([0.75, 0.25]);
  });

  it('si a algún evento le falta el pax, a partes iguales (no se inventa un peso)', () => {
    expect(getEventShares(['Boda A', 'Boda B'], { 'boda a': 150 })).toEqual([0.5, 0.5]);
    expect(getEventShares(['Boda A', 'Boda B', 'Boda C'], {})).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('collectEventNames incluye los eventos registrados en la semana aunque aún no tengan tareas', () => {
    expect(collectEventNames({ events: [{ name: 'Boda Nueva', pax: 90 }] })).toContain('Boda Nueva');
  });
});

describe('buildTaskEventResolver — evento anotado en el planning, sin tocar el texto', () => {
  const weeks = {
    w3: {
      schedule: { martes: { tasks: [
        { text: 'Recogida Evento Delta y descarga en Restaurante', event: 'Evento Delta' },
        { text: 'Boda Ana y Luis - Supervisión', event: 'Otro evento' }, // manda el del texto
        { text: 'Recoger sofá' }, // sin evento anotado
      ] } },
      sundayMonday: { tasks: [{ text: 'Recogida  Boda   Marta ', event: 'Boda Marta' }] },
      saturdaySpecial: { weddings: [{ location: 'El Mirador Este ', truck: 'Camión Gula', event: 'Boda Finca Este' }] },
    },
  };
  const resolve = buildTaskEventResolver(weeks);

  it('enlaza el nombre del fichaje (con horario pegado, espacios raros o sin acentos) con el evento de la tarea', () => {
    expect(resolve('Recogida Evento Delta y descarga en Restaurante (12:00-16:00)')).toBe('Evento Delta');
    expect(resolve('recogida boda marta')).toBe('Boda Marta'); // sin distinguir mayúsculas ni acentos
    expect(resolve('Recogida Boda Marta')).toBe('Boda Marta');
  });

  it('el evento escrito en el texto manda sobre el campo event', () => {
    expect(resolve('Boda Ana y Luis - Supervisión')).toBe('Boda Ana y Luis');
  });

  it('las bodas del sábado se enlazan por su etiqueta de fichaje "Boda: lugar (camión)"', () => {
    expect(resolve('Boda: El Mirador Este  (Camión Gula)')).toBe('Boda Finca Este');
  });

  it('lo desconocido y las tareas sin evento devuelven null (se usa la deducción de siempre)', () => {
    expect(resolve('Recoger sofá')).toBeNull();
    expect(resolve('Inicio de Jornada')).toBeNull();
    expect(buildTaskEventResolver(null)('x')).toBeNull();
  });
});
