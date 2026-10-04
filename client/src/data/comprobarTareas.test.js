import { describe, it, expect } from 'vitest';
import { pideComprobarTareas, buscarEnSemana, quienSueleHacerla, textoComprobacion, tareasNuevas, asignarEnPropuesta, respuestaDeConocimiento, preferenciasDeCorrecciones } from './comprobarTareas';

// La frase tal cual la escribió el admin.
const FRASE = 'Consulta si hay en el planning algo como recoger furgo albacar y recoger generador 7k y si no esta agregalo asignando alguien preguntandote a quien quieres asignar usando siempre el aprendizaje de los trabajadores que hacen esas tareas';

const semana = (tareasMiercoles = []) => ({
  meta: { dateRange: 'Del 6 al 11 de Octubre de 2026' },
  schedule: { martes: { tasks: [] }, miercoles: { tasks: tareasMiercoles }, jueves: { tasks: [] }, viernes: { tasks: [] } },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { tasks: [{ id: 'sl1', text: 'Devolver generadores 7k', timeFrame: '11:00 - 12:00', assigned: ['Luis'], targetDay: 'Lunes' }] },
});
const pasadas = {
  a: semana([{ id: 'x1', text: 'Recoger generadores 7K', timeFrame: '12:30 - 13:00', assigned: ['Ana'] }, { id: 'x2', text: 'Boda Uno - Recoger camion albacar', timeFrame: '12:00 - 13:00', assigned: ['Luis'] }]),
  b: semana([{ id: 'y1', text: 'Recoger Generador 7K', timeFrame: '09:00 - 09:10', assigned: ['Ana', 'Eva'] }]),
};
const equipo = [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }];

describe('comprobar tareas en el planning', () => {
  it('entiende la frase: dos tareas (recoger furgo albacar, recoger generador 7k) y que hay que añadirlas si faltan', () => {
    const r = pideComprobarTareas(FRASE);
    expect(r.items.map(i => i.texto)).toEqual(['recoger furgo albacar', 'recoger generador 7k']);
    expect(r.anadir).toBe(true);
    expect(pideComprobarTareas('Pon a Luis en la carga del jueves')).toBeNull();
  });

  it('las encuentra aunque estén escritas distinto (camión/furgo, plural); recoger no es devolver', () => {
    const s = semana([
      { id: 'mi1', text: 'Logística Preparación - recoger furgo albacar', timeFrame: '09:00 - 10:00', assigned: ['Eva'] },
      { id: 'mi2', text: 'Logística Preparación - Recoger generadores 7K', timeFrame: '09:00 - 10:00', assigned: ['Ana'] },
    ]);
    const [albacar, generador] = pideComprobarTareas(FRASE).items;
    expect(buscarEnSemana(s, albacar).map(e => e.personas)).toEqual([['Eva']]);
    expect(buscarEnSemana(s, generador).map(e => e.texto)).toEqual(['Logística Preparación - Recoger generadores 7K']);
    expect(buscarEnSemana(semana(), generador)).toEqual([]); // «Devolver generadores 7k» del lunes no cuenta
  });

  it('quién la suele hacer: por las semanas pasadas; si nunca se hizo, por las horas de ese tipo en los fichajes', () => {
    const [albacar, generador] = pideComprobarTareas(FRASE).items;
    expect(quienSueleHacerla(generador, { semanas: pasadas, equipo })).toEqual({ lista: [{ nombre: 'Ana', veces: 2 }, { nombre: 'Eva', veces: 1 }], fuente: 'planning' });
    expect(quienSueleHacerla(albacar, { semanas: pasadas, equipo }).lista[0]).toEqual({ nombre: 'Luis', veces: 1 });
    const aprendizaje = { porPersona: { Eva: { 'Recogida y devolución': 6 }, Ana: { Carga: 9 } } };
    expect(quienSueleHacerla({ texto: 'recoger mesas', verbo: 'recoger', claves: ['mesas'] }, { semanas: pasadas, aprendizaje, equipo }))
      .toEqual({ lista: [{ nombre: 'Eva', horas: 6 }], fuente: 'fichajes' });
  });

  it('el texto dice qué está (dónde y con quién) y qué falta (y quién suele hacerla)', () => {
    const s = semana([{ id: 'mi1', text: 'recoger furgo albacar', timeFrame: '09:00 - 10:00', assigned: ['Eva'] }]);
    const res = pideComprobarTareas(FRASE).items.map(item => ({ item, encontradas: buscarEnSemana(s, item), suelen: quienSueleHacerla(item, { semanas: pasadas, equipo }) }));
    const texto = textoComprobacion(res);
    expect(texto).toContain('✅ «recoger furgo albacar» ya está: Miércoles 7, 09:00 - 10:00 — «recoger furgo albacar» (Eva).');
    expect(texto).toContain('➕ «recoger generador 7k» no está en esta semana; suelen hacerla Ana (2 veces), Eva (1 vez).');
  });

  it('localiza las tareas nuevas de una propuesta y deja cambiar quién va sin tocar nada más', () => {
    const antes = semana([{ id: 'mi1', text: 'Carga', timeFrame: '08:00 - 09:00', assigned: ['Luis'] }]);
    const propuesta = semana([{ id: 'mi1', text: 'Carga', timeFrame: '08:00 - 09:00', assigned: ['Luis'] }, { id: 'mi2', text: 'Recoger generador 7k', timeFrame: '10:00 - 10:30', assigned: ['Eva'] }]);
    expect(tareasNuevas(antes, propuesta)).toEqual([{ dia: 'miercoles', clave: 'mi2', texto: 'Recoger generador 7k', personas: ['Eva'] }]);
    const cambiada = asignarEnPropuesta(propuesta, 'mi2', ['Ana']);
    expect(cambiada.schedule.miercoles.tasks[1].assigned).toEqual(['Ana']);
    expect(cambiada.schedule.miercoles.tasks[0]).toBe(propuesta.schedule.miercoles.tasks[0]);
  });
});

describe('el asistente sabe sin Gemini y aprende de las correcciones', () => {
  const aprendizaje = {
    porPersona: { Ana: { Carga: 12 }, Luis: { Carga: 4, Limpieza: 6 } },
    planning: { camiones: [{ camion: 'Camión Norte', personas: [{ nombre: 'Luis', veces: 5 }, { nombre: 'Ana', veces: 2 }] }], recurrentes: [] },
  };

  it('«¿quién suele…?»: el camión (del grafo), una tarea (otras semanas) o un tipo (fichajes)', () => {
    expect(respuestaDeConocimiento('¿Quién suele llevar el camión Norte?', { aprendizaje, equipo }))
      .toBe('Con el Camión Norte suelen ir: Luis (5 veces), Ana (2 veces) (veces juntos en el planning).');
    expect(respuestaDeConocimiento('¿Quién suele recoger el generador 7k?', { aprendizaje, semanas: pasadas, equipo }))
      .toBe('«recoger el generador 7k»: Ana (2 veces), Eva (1 vez) (otras semanas).');
    expect(respuestaDeConocimiento('¿Quién hace mejor las cargas?', { aprendizaje, equipo })).toBe('Carga: Ana (12 h), Luis (4 h) (horas fichadas).');
    expect(respuestaDeConocimiento('Pon a Luis en la carga del jueves', { aprendizaje, equipo })).toBeNull();
  });

  it('lo que el admin corrige en «¿Quién va?» se convierte en una regla propuesta; si no corrige nada, no', () => {
    const antes = semana([]);
    const deGemini = semana([{ id: 'mi2', text: 'Recoger generador 7k', timeFrame: '10:00 - 10:30', assigned: ['Eva'] }]);
    expect(preferenciasDeCorrecciones(antes, deGemini, asignarEnPropuesta(deGemini, 'mi2', ['Ana']))).toEqual(['Para «Recoger generador 7k» prefiero a Ana.']);
    expect(preferenciasDeCorrecciones(antes, deGemini, deGemini)).toEqual([]);
  });
});
