import { describe, it, expect, vi, afterEach } from 'vitest';
import { elegirModo, pareceRegla, semanaEnLineas, aplicarCambios, promptDeCambios, editarConGemini, resolverPeticion, revisarBorradorConGemini } from './editorIa';
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
  });
});

describe('semana en líneas y cambios', () => {
  it('una línea por tarea, con código corto y las hechas marcadas', () => {
    const { lineas, mapa } = semanaEnLineas(semana());
    expect(lineas).toEqual([
      'T1|mar|09:00-11:00|Boda Uno - Carga|Ana|HECHA',
      'T2|mar|12:00-15:00|Boda Uno - Descarga + Montaje Estructura|Ana,Luis',
      expect.stringMatching(/^T3\|sab\|20:30-00:30\|.*Finca Norte.*\|Ana$/),
      'T4|lun|10:00-13:00|Limpieza Eventos - Vajilla|Eva',
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
  const FRASE = 'Consulta si hay en el planning algo como recoger furgo albacar y recoger generador 7k y si no esta agregalo asignando alguien preguntandote a quien quieres asignar';
  const conRecogidas = (extra = []) => {
    const s = semana();
    s.schedule.miercoles.tasks = [{ id: 'mi1', text: 'Logística - recoger furgo albacar', timeFrame: '09:00 - 10:00', assigned: ['Luis'] }, ...extra];
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
    expect(r.resumen).toMatch(/✅ «recoger furgo albacar» ya está: .*\(Luis\)/);
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
    expect(prompt).not.toContain('recoger furgo albacar»'); // la que ya está no se le pide
  });
});
