import { describe, it, expect } from 'vitest';
import { parseEventAndTask, getEventName, inferCategory, buildEventName, normalizeGeneratedEvents, collectEventNames } from './eventNaming';

describe('parseEventAndTask', () => {
  it('"Evento - Tarea" explícito: separa por el guion normal', () => {
    expect(parseEventAndTask('Boda Ana y Luis - Descarga + Montaje Estructura'))
      .toEqual({ eventName: 'Boda Ana y Luis', specificTaskName: 'Descarga + Montaje Estructura', explicit: true });
  });

  it('BUG evitado: una raya larga con descripción NO es un evento (antes cada tarea era su "evento")', () => {
    const r = parseEventAndTask('Recoger Sillas Carvillo — 90 sillas en jaula + jaula vacía.');
    expect(r.explicit).toBe(false);
    expect(r.eventName).toBe('Logística Preparación');
  });

  it('el horario entre paréntesis no se confunde con un guion', () => {
    expect(getEventName('Recogida Evento Encamina y descarga en Restaurante (12:00-16:00)')).toBe('Logística Preparación');
    expect(getEventName('Boda Ana y Luis - Supervisión (09:00-11:00)')).toBe('Boda Ana y Luis');
  });

  it('fichaje de boda de sábado: Boda + primera parte del lugar, sin camión ni dirección', () => {
    expect(getEventName('Boda: El Cerrao Sot de Chera  (Camión Gula + Camion Albacar)')).toBe('Boda El Cerrao Sot de Chera');
    expect(getEventName('Boda: Partida Paraíso, 35, 03570 La Vila Joiosa, Alicante, España   (Camión Albacar (Alquiler))')).toBe('Boda Partida Paraíso');
  });

  it('un texto que empieza por Boda/Evento usa ese nombre como evento', () => {
    expect(getEventName('Evento SUOT — logística completa, descarga y montaje de estructura + comida')).toBe('Evento SUOT');
    expect(getEventName('Boda Rocio y Pedro, carga de material')).toBe('Boda Rocio y Pedro');
  });

  it('categorías generales: limpieza, carga, y logística por defecto', () => {
    expect(inferCategory('Limpieza y recogida final del servicio')).toBe('Limpieza Eventos');
    expect(inferCategory('Carga de material — Camión Covey')).toBe('Logística Carga');
    expect(inferCategory('Descarga y montaje de estructura')).toBe('Logística Preparación'); // "descarga" no es "carga"
    expect(inferCategory('Devolución Dealde')).toBe('Logística Preparación');
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
