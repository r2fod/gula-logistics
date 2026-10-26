import { describe, it, expect, vi, afterEach } from 'vitest';
import { elegirModo, pareceRegla, semanaEnLineas, aplicarCambios, promptDeCambios, editarConGemini, resolverPeticion, revisarBorradorConGemini, esPregunta } from './editorIa';
import { generateScheduleWithGemini } from './geminiScheduleService';

const equipo = [{ name: 'Ana', role: 'Conductora' }, { name: 'Luis', role: 'Apoyo logística' }, { name: 'Eva', role: 'Limpieza' }];
const semana = () => ({
  meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' },
  events: [{ name: 'Boda Uno', pax: 120 }],
  schedule: {
    martes: { title: 'Martes', badge: 'x', tasks: [
      { id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 11:00', assigned: ['Ana'], completed: true, phone: '600000000', mapsUrl: 'https://maps/a' },
      { id: 'm2', text: 'Boda Uno - Descarga + Montaje Estructura', location: 'Finca Norte', timeFrame: '12:00 - 15:00', assigned: ['Ana', 'Luis'] },
    ] },
    miercoles: { tasks: [] }, jueves: { tasks: [] }, viernes: { tasks: [] },
  },
  saturdaySpecial: { weddings: [{ location: 'Finca Norte', details: 'Boda Uno — Recogida', timeFrame: '20:30 - 00:30', assigned: ['Ana'] }] },
  sundayMonday: { tasks: [{ id: 'sl1', text: 'Limpieza Eventos - Vajilla', timeFrame: '10:00 - 13:00', assigned: ['Eva'], targetDay: 'Lunes' }] },
});
const respuesta = (obj, uso = { promptTokenCount: 400, candidatesTokenCount: 30, thoughtsTokenCount: 50, totalTokenCount: 480 }) => ({
  ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: uso }),
});

describe('qué camino sigue cada petición', () => {
  it('cambios concretos por defecto; planificar o rehacer, entero; semana vacía, entera', () => {
    expect(elegirModo('Pon a Luis en la carga del jueves', semana())).toBe('cambios');
    expect(elegirModo('Rehaz toda la semana con menos horas', semana())).toBe('completo');
    expect(elegirModo('Ajusta los horarios a lo que duran según los fichajes', semana())).toBe('completo');
    expect(elegirModo('Pon a Luis en la carga', { schedule: {} })).toBe('completo');
  });

  it('solo lo que suena a regla gasta la llamada de la memoria', () => {
    expect(pareceRegla('A partir de ahora las bodas grandes llevan un apoyo más')).toBe(true);
    expect(pareceRegla('Luis nunca conduce el camión grande')).toBe(true);
    expect(pareceRegla('Pon a Luis en la carga del jueves')).toBe(false);
    expect(pareceRegla('Sigue estas reglas fijas: la boda la montan Ana y Luis')).toBe(true);
  });
});

describe('semana en líneas y cambios', () => {
  it('una línea por tarea, con código corto y las hechas marcadas', () => {
    const { lineas, mapa } = semanaEnLineas(semana());
    expect(lineas).toEqual([
      'T1|mar|09:00-11:00|Boda Uno - Carga|Ana||HECHA',
      'T2|mar|12:00-15:00|Boda Uno - Descarga + Montaje Estructura|Ana,Luis|',
      'T3|sab|20:30-00:30|Boda Uno — Recogida (Finca Norte)|Ana|',
      'T4|lun|10:00-13:00|Limpieza Eventos - Vajilla|Eva|',
    ]);
    expect(mapa.T2).toMatchObject({ lista: 'martes', indice: 1 });
  });

  it('aplica personas, horario, texto, quitar y nueva; no toca las HECHA', () => {
    const { mapa } = semanaEnLineas(semana());
    const { plan, aplicados, ignorados } = aplicarCambios(semana(), [
      { op: 'personas', t: 'T2', personas: ['Luis'] },
      { op: 'horario', t: 'T4', horario: '9:00-12:00' },
      { op: 'personas', t: 'T1', personas: ['Luis'] }, // hecha: se ignora
      { op: 'quitar', t: 'T3' },
      { op: 'nueva', dia: 'jue', texto: 'Logística Preparación - Recoger mesas', horario: '08:00-09:00', lugar: 'Alquileres Sur', personas: ['Ana'] },
      { op: 'personas', t: 'T99', personas: ['Ana'] }, // no existe
    ], mapa);
    expect(aplicados).toBe(4);
    expect(ignorados).toBe(2);
    expect(plan.schedule.martes.tasks[1].assigned).toEqual(['Luis']);
    expect(plan.schedule.martes.tasks[0].assigned).toEqual(['Ana']);
    expect(plan.sundayMonday.tasks[0].timeFrame).toBe('09:00 - 12:00');
    expect(plan.saturdaySpecial.weddings).toEqual([]);
    expect(plan.schedule.jueves.tasks[0]).toMatchObject({ text: 'Logística Preparación - Recoger mesas', assigned: ['Ana'] });
  });
});

describe('vehículos: Gemini los ve y los reparte (solo los de la flota)', () => {
  const conFlota = () => ({ ...semana(), trucks: [{ name: 'Camión A' }, { name: 'Furgoneta B' }] });

  it('BUG evitado: cada línea lleva su vehículo y el prompt la flota de la semana (antes no podía repartir camiones)', () => {
    const s = conFlota();
    s.schedule.martes.tasks[1].truck = 'Camión A';
    expect(semanaEnLineas(s).lineas[1]).toBe('T2|mar|12:00-15:00|Boda Uno - Descarga + Montaje Estructura|Ana,Luis|Camión A');
    const texto = promptDeCambios({ semana: s, equipo, peticion: 'La boda con el Camión A' });
    expect(texto).toMatch(/Vehículos de la semana: Camión A; Furgoneta B\./);
    expect(texto).toMatch(/personas\|vehículo\)/);
  });

  it('aplica vehiculo (y con personas o nueva); un vehículo que no es de la flota se ignora', () => {
    const s = conFlota();
    const { mapa } = semanaEnLineas(s);
    const { plan, aplicados, ignorados } = aplicarCambios(s, [
      { op: 'vehiculo', t: 'T2', vehiculo: 'camion a + Furgoneta B' },
      { op: 'personas', t: 'T3', personas: ['Luis'], vehiculo: 'Furgoneta B' },
      { op: 'vehiculo', t: 'T4', vehiculo: 'Camión Inventado' },
      { op: 'nueva', dia: 'jue', texto: 'Boda Uno - Carga', horario: '08:00-09:00', personas: ['Ana'], vehiculo: 'Camión A' },
    ], mapa);
    expect([aplicados, ignorados]).toEqual([3, 1]);
    expect(plan.schedule.martes.tasks[1].truck).toBe('Camión A + Furgoneta B');
    expect(plan.saturdaySpecial.weddings[0]).toMatchObject({ assigned: ['Luis'], truck: 'Furgoneta B' });
    expect(plan.sundayMonday.tasks[0].truck).toBeUndefined();
    expect(plan.schedule.jueves.tasks[0].truck).toBe('Camión A');
  });
});

describe('eventos: lo que dice el texto manda', () => {
  it('BUG evitado: cambiar el texto a otro evento cambia también su etiqueta (antes seguía «Produ»); el sábado también', () => {
    const s = semana();
    s.schedule.martes.tasks[1].event = 'Produ';
    s.saturdaySpecial.weddings[0].event = 'Produ';
    const { mapa } = semanaEnLineas(s);
    const { plan } = aplicarCambios(s, [
      { op: 'texto', t: 'T2', texto: 'Boda Uno - Descarga' },
      { op: 'texto', t: 'T3', texto: 'Boda Uno — Recogida del evento' },
      { op: 'nueva', dia: 'mie', texto: 'Produ - Carga', horario: '08:00-09:00', personas: ['Luis'] },
    ], mapa);
    expect(plan.schedule.martes.tasks[1]).toMatchObject({ text: 'Boda Uno - Descarga', event: 'Boda Uno' });
    expect(plan.saturdaySpecial.weddings[0].event).toBe('Boda Uno');
    expect(plan.schedule.miercoles.tasks[0].event).toBe('Produ');
  });

  it('la petición manda sobre las reglas generales («el jefe no carga» si piden que cargue)', () => {
    expect(promptDeCambios({ semana: semana(), equipo, peticion: 'x' })).toMatch(/si la petición dice otra cosa, manda la petición/);
  });
});

describe('editarConGemini — mínimos tokens', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('manda la semana en líneas (mucho más corta que el modo completo) y aplica solo los cambios', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ cambios: [{ op: 'personas', t: 'T2', personas: ['Luis'] }] }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await editarConGemini({ peticion: 'Quita a Ana de la descarga del martes', apiKey: 'k', semana: semana(), equipo });
    expect(r.errorMsg).toBe('');
    expect(r.uso).toEqual({ entrada: 400, respuesta: 30, pensamiento: 50, total: 480 });
    expect(r.generatedJson.schedule.martes.tasks[1].assigned).toEqual(['Luis']);
    expect(r.generatedJson.schedule.martes.tasks[0]).toEqual(semana().schedule.martes.tasks[0]); // la hecha, intacta
    const { generationConfig, contents } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(generationConfig.thinkingConfig).toEqual({ thinkingBudget: 512 });
    expect(generationConfig.responseSchema.properties.cambios.items.properties.personas.items.enum).toEqual(['Ana', 'Luis', 'Eva']);
    const textoCambios = contents[0].parts[0].text;
    expect(textoCambios).not.toMatch(/600000000|maps/);

    fetchMock.mockResolvedValue(respuesta({ schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } }));
    await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', activeWeekData: semana(), roster: equipo });
    const textoCompleto = JSON.parse(fetchMock.mock.calls[1][1].body).contents[0].parts[0].text;
    expect(textoCambios.length).toBeLessThan(textoCompleto.length / 2);
  });

  it('si Gemini no propone nada aplicable, error claro y nada tocado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ cambios: [{ op: 'personas', t: 'T1', personas: ['Luis'] }] })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await editarConGemini({ peticion: 'x', apiKey: 'k', semana: semana(), equipo });
    expect(r.generatedJson).toBeNull();
    expect(r.errorMsg).toMatch(/no se pueden aplicar/);
  });

  it('el prompt lleva disponibilidad, límites y preferencias en una línea cada una', () => {
    const texto = promptDeCambios({
      semana: semana(), equipo, peticion: 'x',
      restricciones: [{ persona: 'Ana', dia: 'jueves', tipo: 'no' }],
      limites: { maxHorasDia: 10, descansoMinHoras: 11 },
      memorias: [{ content: 'Las bodas grandes llevan un apoyo más' }, { content: 'Pendiente', estado: 'propuesta' }],
    });
    expect(texto).toMatch(/No disponible: Ana no puede el jueves\./);
    expect(texto).toMatch(/máx 10 h\/día y 11 h de descanso/);
    expect(texto).toMatch(/Preferencias: Las bodas grandes llevan un apoyo más\./);
    expect(texto).not.toMatch(/Pendiente/);
  });
});

describe('resolverPeticion — el camino que menos gasta', () => {
  afterEach(() => vi.unstubAllGlobals());
  const semanaFutura = () => ({ ...semana(), meta: { dateRange: 'Del 20 al 25 de Octubre de 2026' } });

  it('"X no puede el martes": se entiende en la app (0 tokens, sin llamar a Gemini) y reajusta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const equipoConOtro = [...equipo, { name: 'Pau', role: 'Conductor' }];
    const r = await resolverPeticion({ peticion: 'Ana no puede el martes', apiKey: 'k', semana: semanaFutura(), equipo: equipoConOtro, ahora: new Date(2026, 9, 1) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.via).toBe('local');
    expect(r.generatedJson.disponibilidad).toEqual([expect.objectContaining({ persona: 'Ana', dia: 'martes', tipo: 'no' })]);
    expect(r.generatedJson.schedule.martes.tasks[1].assigned).not.toContain('Ana');
    expect(r.generatedJson.schedule.martes.tasks[0].assigned).toEqual(['Ana']); // la hecha no se toca
    expect(r.resumen).toMatch(/^Entendido sin gastar Gemini: Ana no puede el martes\. 1 tarea cambia de persona\./);
  });

  it('"¿Qué puedes hacer?" se contesta sin Gemini, con ejemplos del propio equipo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: 'Dime que puedes hacer?', apiKey: '', semana: semana(), equipo });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ via: 'local', generatedJson: null, errorMsg: '' });
    expect(r.resumen).toMatch(/«Ana no puede el jueves»/);
  });

  it('un cambio concreto va por "cambios"; rehacer la semana, por "completo"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ cambios: [{ op: 'personas', t: 'T2', personas: ['Luis'] }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await resolverPeticion({ peticion: 'Pon solo a Luis en la descarga', apiKey: 'k', semana: semana(), equipo })).via).toBe('cambios');
    fetchMock.mockResolvedValue(respuesta({ schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } }));
    expect((await resolverPeticion({ peticion: 'Rehaz toda la semana', apiKey: 'k', semana: semana(), equipo })).via).toBe('completo');
  });
});

describe('revisarBorradorConGemini — el calendario crea, Gemini mejora, el admin acepta', () => {
  afterEach(() => vi.unstubAllGlobals());
  const borrador = () => ({
    meta: { dateRange: 'Del 20 al 25 de Octubre de 2026', status: 'Borrador', disponibilidad: [{ id: 'r', persona: 'Ana', dia: 'jueves', tipo: 'no' }] },
    schedule: {
      martes: { tasks: [{ id: 'm1', text: 'Boda Uno - Carga de material', timeFrame: '08:00 - 10:00', assigned: ['Luis'], perfil: 'carga', personas: 1 }] },
      miercoles: { tasks: [] },
      jueves: { tasks: [{ id: 'j1', text: 'Boda Uno - Descarga + Montaje Estructura', timeFrame: '10:00 - 13:00', assigned: ['Luis'], perfil: 'carga', personas: 1 }] },
      viernes: { tasks: [] },
    },
    saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
  });
  const conductores = [{ name: 'Ana', role: 'Conductora' }, { name: 'Luis', role: 'Conductor' }, { name: 'Pau', role: 'Conductor' }];

  it('aplica sus mejoras y, si rompe una regla estricta (Ana no puede el jueves), el optimizador lo arregla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ cambios: [{ op: 'personas', t: 'T2', personas: ['Ana'] }] })));
    const r = await revisarBorradorConGemini({ semana: borrador(), apiKey: 'k', equipo: conductores, ahora: new Date(2026, 9, 1) });
    expect(r.errorMsg).toBe('');
    expect(r.aplicados).toBe(1);
    expect(r.generatedJson.schedule.jueves.tasks[0].assigned).not.toContain('Ana');
    expect(r.generatedJson.schedule.jueves.tasks[0].assigned).toHaveLength(1);
  });

  it('si ya está bien, no cambia nada y no es un error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ cambios: [] })));
    const r = await revisarBorradorConGemini({ semana: borrador(), apiKey: 'k', equipo: conductores });
    expect(r).toMatchObject({ generatedJson: null, aplicados: 0, errorMsg: '' });
    expect(r.uso.total).toBe(480);
  });

  it('le pasa lo aprendido de los fichajes en el prompt compacto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ cambios: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const aprendizaje = { porTipo: [{ tipo: 'Carga', tareas: 5, planificadoMin: 90, realMin: 130, desvioMin: 40 }], porPersona: {} };
    await revisarBorradorConGemini({ semana: borrador(), apiKey: 'k', equipo: conductores, aprendizaje });
    const texto = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(texto).toMatch(/Aprendido de los fichajes reales:[\s\S]*Carga: planificadas/);
    expect(texto).toMatch(/Petición: Revisa este borrador/);
  });
});

describe('«¿hay … en el planning? si no, añádelo» — comprobar antes de tocar', () => {
  afterEach(() => vi.unstubAllGlobals());
  const FRASE = 'Consulta si hay en el planning algo como recoger furgo norte y recoger generador 7k y si no esta agregalo asignando alguien preguntandote a quien quieres asignar';
  const conRecogidas = (extra = []) => {
    const s = semana();
    s.schedule.miercoles.tasks = [{ id: 'mi1', text: 'Logística - recoger furgo norte', timeFrame: '09:00 - 10:00', assigned: ['Luis'] }, ...extra];
    return s;
  };

  it('BUG evitado: «generador» ya no cuenta como «genera la semana» (rehacía la semana entera)', () => {
    expect(elegirModo('Añade recoger generador 7k el miércoles', semana())).toBe('cambios');
    expect(elegirModo('Genera la semana', semana())).toBe('completo');
  });

  it('si ya está todo, lo dice (dónde y con quién) sin gastar Gemini ni tocar nada', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const s = conRecogidas([{ id: 'mi2', text: 'Logística - recoger generadores 7k', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }]);
    const r = await resolverPeticion({ peticion: FRASE, apiKey: 'k', semana: s, equipo });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ via: 'local', generatedJson: null });
    expect(r.resumen).toMatch(/✅ «recoger furgo norte» ya está: .*\(Luis\)/);
    expect(r.resumen).toMatch(/✅ «recoger generador 7k» ya está: .*\(Ana\)/);
  });

  it('si falta una, Gemini SOLO la añade: lo demás que proponga se descarta; y dice quién la suele hacer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ cambios: [
      { op: 'nueva', dia: 'mie', horario: '10:00-10:30', texto: 'Logística - Recoger generador 7k', personas: ['Ana'] },
      { op: 'horario', t: 'T2', horario: '07:00-14:35' }, // como las bodas que movió: fuera
    ] }));
    vi.stubGlobal('fetch', fetchMock);
    const semanas = { vieja: { ...semana(), schedule: { ...semana().schedule, viernes: { tasks: [{ id: 'v1', text: 'Recoger generadores 7K', timeFrame: '12:30 - 13:00', assigned: ['Ana'] }] } } } };
    const s = conRecogidas();
    const r = await resolverPeticion({ peticion: FRASE, apiKey: 'k', semana: s, equipo, semanas });
    expect(r.via).toBe('cambios');
    expect(r.ignorados).toBe(1);
    expect(r.generatedJson.schedule.miercoles.tasks.map(t => t.text)).toContain('Logística - Recoger generador 7k');
    expect(r.generatedJson.schedule.martes.tasks[1].timeFrame).toBe(s.schedule.martes.tasks[1].timeFrame); // no se movió nada más
    expect(r.resumen).toContain('➕ «recoger generador 7k» no está en esta semana; suelen hacerla Ana (1 vez).');
    expect(r.sugerencias.map(x => x.item.texto)).toEqual(['recoger generador 7k']);
    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toContain('Añade SOLO estas tareas');
    expect(prompt).not.toContain('recoger furgo norte»'); // la que ya está no se le pide
  });
});

describe('el asistente contesta lo que ya sabe sin gastar Gemini', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('«¿quién suele llevar el camión Norte?» sale del grafo, 0 tokens', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const aprendizaje = { porTipo: [], porPersona: {}, planning: { camiones: [{ camion: 'Camión Norte', personas: [{ nombre: 'Luis', veces: 4 }] }], recurrentes: [] } };
    const r = await resolverPeticion({ peticion: '¿Quién suele llevar el camión Norte?', apiKey: 'k', semana: semana(), equipo, aprendizaje });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ via: 'local', generatedJson: null, resumen: 'Con el Camión Norte suelen ir: Luis (4 veces) (veces juntos en el planning).' });
  });
});

describe('preguntas, hoy y «nada que cambiar»', () => {
  afterEach(() => vi.unstubAllGlobals());
  const semanaFutura = () => ({ ...semana(), meta: { dateRange: 'Del 20 al 25 de Octubre de 2026' } });

  it('distingue una pregunta de un cambio pedido con educación', () => {
    expect(esPregunta('¿Qué tareas tiene Ana el jueves?')).toBe(true);
    expect(esPregunta('cuantas horas lleva Luis esta semana')).toBe(true);
    expect(esPregunta('¿Puedes poner a Luis en la carga?')).toBe(false);
    expect(esPregunta('¿Cambia la recogida a las 8?')).toBe(false);
    expect(esPregunta('Pon a Luis en la carga')).toBe(false);
  });

  it('BUG evitado: una pregunta iba por «cambios» y acababa en «no ha propuesto ningún cambio»: ahora Gemini contesta en texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ respuesta: 'Ana: martes de 12:00 a 15:00, la descarga.' }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: '¿Qué tareas tiene Ana esta semana?', apiKey: 'k', semana: semana(), equipo });
    expect(r).toMatchObject({ via: 'pregunta', generatedJson: null, errorMsg: '', resumen: 'Ana: martes de 12:00 a 15:00, la descarga.' });
    const { generationConfig, contents } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(generationConfig.responseSchema.properties).toHaveProperty('respuesta');
    expect(contents[0].parts[0].text).toMatch(/Pregunta: ¿Qué tareas tiene Ana esta semana\?/);
  });

  it('BUG evitado: Gemini no sabía qué día es hoy («mañana» no tenía a qué referirse)', () => {
    const texto = promptDeCambios({ semana: semanaFutura(), equipo, peticion: 'Pon a Luis en la carga de mañana', ahora: new Date(2026, 9, 19, 10) });
    expect(texto).toMatch(/Hoy es lunes, 19 de octubre/);
    expect(texto).toMatch(/mar=Martes 20/);
  });

  it('«X no viene mañana» se entiende sin Gemini con el día de mañana dentro de la semana abierta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: 'Ana no viene mañana', apiKey: 'k', semana: semanaFutura(), equipo, ahora: new Date(2026, 9, 19, 10) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.generatedJson.disponibilidad).toEqual([expect.objectContaining({ persona: 'Ana', dia: 'martes', tipo: 'no' })]);
  });

  it('si Gemini no propone cambios (una regla para siempre, o ya se cumple) no es un error: lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ cambios: [] })));
    const r = await editarConGemini({ peticion: 'A partir de ahora las bodas grandes llevan un apoyo más', apiKey: 'k', semana: semana(), equipo });
    expect(r).toMatchObject({ generatedJson: null, errorMsg: '', aplicados: 0 });
    expect(r.resumen).toMatch(/no ve nada que cambiar/);
  });

  it('si el modelo no acepta el ajuste de razonamiento (400), lo repite CON el esquema y sin ese ajuste', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce(respuesta({ cambios: [{ op: 'personas', t: 'T2', personas: ['Luis'] }] }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await editarConGemini({ peticion: 'Pon solo a Luis en la descarga', apiKey: 'k', semana: semana(), equipo });
    expect(r.errorMsg).toBe('');
    const segundo = JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig;
    expect(segundo.responseSchema).toBeDefined();
    expect(segundo.thinkingConfig).toBeUndefined();
  });
});

describe('acciones fuera del cuadrante y mover una tarea', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('«Eva nunca puede los lunes» es su disponibilidad fija: se propone sin Gemini, para confirmar', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: 'Eva nunca puede los lunes', apiKey: 'k', semana: semana(), equipo });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toMatchObject({ via: 'local', generatedJson: null });
    expect(r.acciones).toEqual([expect.objectContaining({ tipo: 'disponibilidad', ok: true, persona: 'Eva' })]);
  });

  it('una tarifa va a Gemini como acción del catálogo, comprobada y sin aplicar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ acciones: [{ tipo: 'tarifa', persona: 'Luis', tarifa: 12 }] }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: 'Luis cobra 12 € la hora', apiKey: 'k', semana: semana(), equipo });
    expect(r.via).toBe('acciones');
    expect(r.acciones).toEqual([expect.objectContaining({ tipo: 'tarifa', ok: true, persona: 'Luis', tarifa: 12 })]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseSchema.properties).toHaveProperty('acciones');
  });

  it('si Gemini no ve ninguna acción de la app, sigue como petición del cuadrante', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respuesta({ acciones: [] }))
      .mockResolvedValueOnce(respuesta({ cambios: [{ op: 'personas', t: 'T2', personas: ['Luis'] }] }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await resolverPeticion({ peticion: 'Apunta a Luis solo en la descarga', apiKey: 'k', semana: semana(), equipo });
    expect(r.via).toBe('cambios');
    expect(r.generatedJson.schedule.martes.tasks[1].assigned).toEqual(['Luis']);
  });

  it('«mover» pasa la tarea entera a otro día (hora, gente, lugar) con un id de ese día; la hecha y el sábado no', () => {
    const { mapa } = semanaEnLineas(semana());
    const { plan, aplicados, ignorados } = aplicarCambios(semana(), [
      { op: 'mover', t: 'T2', dia: 'jue' },
      { op: 'horario', t: 'T2', horario: '10:00-13:00' }, // aunque venga después, se lleva el cambio
      { op: 'mover', t: 'T1', dia: 'mie' }, // hecha
      { op: 'mover', t: 'T4', dia: 'sab' }, // al sábado no
    ], mapa);
    expect(aplicados).toBe(2);
    expect(ignorados).toBe(2);
    expect(plan.schedule.martes.tasks.map(t => t.id)).toEqual(['m1']);
    expect(plan.schedule.jueves.tasks).toEqual([expect.objectContaining({ text: 'Boda Uno - Descarga + Montaje Estructura', location: 'Finca Norte', assigned: ['Ana', 'Luis'], timeFrame: '10:00 - 13:00' })]);
    expect(plan.schedule.jueves.tasks[0].id).toBeUndefined();
  });
});

describe('preguntas: las órdenes que empiezan por «que» no lo son', () => {
  it('BUG evitado: «Que Luis haga la carga del jueves» se tomaba por pregunta (Gemini contestaba y no cambiaba nada)', () => {
    expect(esPregunta('Que Luis haga la carga del jueves')).toBe(false);
    expect(esPregunta('cuando acabe la boda que Ana recoja el generador')).toBe(false);
    expect(esPregunta('Qué tareas tiene Ana el jueves')).toBe(true); // con tilde, sí
    expect(esPregunta('quien hace la carga del viernes')).toBe(true);
    expect(esPregunta('que hay el sabado?')).toBe(true); // con «?», sí
  });
});
