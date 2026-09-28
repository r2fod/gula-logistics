import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWeekPrompt, generateScheduleWithGemini, validateGeneratedSchedule, extraerMemoriaDelPrompt, GEMINI_MODELS } from './geminiScheduleService';
import { completarPlanGenerado } from './planificadorIa';

const base = { weekName: 'Semana 4', dateRange: 'Del 22 al 27 de Septiembre de 2026', trucks: ['Camión Gula'], workers: ['Ana', 'Luis'] };
const dia = { martes: 'Martes 22', viernes: 'Viernes 25', sabado: 'Sábado 26' };
const dayLabel = (k) => dia[k] || k;

describe('buildWeekPrompt', () => {
  it('BUG evitado: una boda de viernes y dos eventos de martes llegan al prompt con su día', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [
        { day: 'viernes', kind: 'Boda', place: 'Finca Norte', time: '' },
        { day: 'martes', kind: 'Evento', place: 'Catering Uno', time: '20:00-23:00' },
        { day: 'martes', kind: 'Evento', place: 'Catering Dos', time: '' },
      ],
    });
    expect(p).toContain('- Martes 22: Evento Catering Uno (20:00-23:00).');
    expect(p).toContain('- Martes 22: Evento Catering Dos.');
    expect(p).toContain('- Viernes 25: Boda Finca Norte.');
    // ordenados por día aunque se hayan añadido en otro orden
    expect(p.indexOf('Martes 22: Evento Catering Uno')).toBeLessThan(p.indexOf('Viernes 25'));
  });

  it('sin eventos de sábado le dice a la IA que no genere bodas de sábado', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [{ day: 'martes', kind: 'Evento', place: 'X', time: '' }] });
    expect(p).toContain('El sábado no hay bodas esta semana');
  });

  it('con un evento de sábado no lo dice, y lo manda a saturdaySpecial.weddings', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [{ day: 'sabado', kind: 'Boda', place: 'Finca Sur', time: '' }] });
    expect(p).not.toContain('El sábado no hay bodas esta semana');
    expect(p).toContain('saturdaySpecial.weddings');
  });

  it('sin ningún evento lo indica y no inventa bodas', () => {
    const p = buildWeekPrompt({ ...base, dayLabel, events: [] });
    expect(p).toContain('No hay bodas ni eventos esta semana');
  });

  it('ignora filas con día desconocido y recorta espacios', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [{ day: 'nunca', kind: 'Boda', place: 'Fantasma' }, { day: 'martes', kind: 'Boda', place: '  Finca Real  ', time: ' 10:00 ' }],
    });
    expect(p).not.toContain('Fantasma');
    expect(p).toContain('Boda Finca Real (10:00).');
  });
});

const okResponse = (obj) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const semanaOk = { meta: { week: 'Semana 4' }, schedule: { martes: { tasks: [] } }, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } };
// Lo que devuelve la app: la propuesta ya completada (planificadorIa.js).
const planOk = completarPlanGenerado(semanaOk);

describe('generateScheduleWithGemini — nunca inventa una semana', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin clave en el navegador pasa por el servidor (su clave, solo admin); la del navegador no viaja', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '  ' });
    expect(r.generatedJson).toEqual(planOk);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/ia\/gemini$/);
    expect(opts.headers['x-goog-api-key']).toBeUndefined();
  });

  it('BUG evitado: si nadie tiene clave, error claro (nunca una demo con eventos de otra semana)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '' });
    expect(r.generatedJson).toBeNull();
    expect(r.errorMsg).toContain('falta la clave de Gemini');
    expect(r.errorMsg).toContain('GEMINI_API_KEY');
    expect(JSON.stringify(r)).not.toContain('Evento Especial 3');
  });

  it('sin clave y con un servidor que aún no tiene /api/ia (404), el mismo consejo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '' });
    expect(r.errorMsg).toContain('falta la clave de Gemini');
  });

  it('BUG evitado: Google saturado (503) NO se toma por "falta la clave"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded. Please try again later.' } }) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '' });
    expect(r.errorMsg).toMatch(/saturado ahora mismo/);
    expect(r.errorMsg).not.toMatch(/falta la clave/);
  });

  it('BUG evitado: un modelo retirado (404 NOT_FOUND de Google) no se toma por "falta la clave"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: { code: 404, status: 'NOT_FOUND', message: 'models/x is not found' } }) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '' });
    expect(r.errorMsg).toMatch(/ya no tiene ese modelo/);
    expect(r.errorMsg).not.toMatch(/falta la clave/);
  });

  it('si el servidor dice que no tiene clave, se enseña su motivo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'El servidor no tiene clave de Gemini (GEMINI_API_KEY en Render).' }) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '' });
    expect(r.errorMsg).toMatch(/El servidor no tiene clave de Gemini/);
  });

  it('con clave del navegador, si un modelo está saturado prueba el siguiente', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k' });
    expect(r.generatedJson).toEqual(planOk);
    expect(fetchMock.mock.calls[1][0]).toContain(GEMINI_MODELS[1]);
  });

  it('con clave devuelve el JSON y manda la clave en la cabecera, no en la URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'CLAVE-FALSA' });
    expect(r).toMatchObject({ generatedJson: planOk, errorMsg: '' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain(GEMINI_MODELS[0]);
    expect(url).not.toContain('CLAVE-FALSA');
    expect(opts.headers['x-goog-api-key']).toBe('CLAVE-FALSA');
    expect(JSON.parse(opts.body).generationConfig.responseMimeType).toBe('application/json');
  });

  it('si el modelo ya no existe (404) prueba el siguiente', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k' });
    expect(r.generatedJson).toEqual(planOk);
    expect(fetchMock.mock.calls[1][0]).toContain(GEMINI_MODELS[1]);
  });

  it('un error de la API devuelve null + mensaje (con pista si la clave es mala), nunca una demo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k' });
    expect(r.generatedJson).toBeNull();
    expect(r.errorMsg).toContain('403');
    expect(r.errorMsg).toContain('clave');
  });

  const equipo = [{ name: 'Ana', role: 'Conductora', rate: 37 }, { name: 'Luis', role: 'Apoyo', rate: 37 }];
  const semanaReal = {
    meta: { week: 'Semana 9', dateRange: 'Del 22 al 27 de Septiembre de 2026', status: 'Borrador' },
    schedule: { martes: { tasks: [{ id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 11:00', assigned: ['Ana'], completed: true, phone: '600000000', mapsUrl: 'https://maps/x' }] } },
    saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
  };

  it('pide la respuesta con esquema (solo nombres del equipo) y temperatura baja', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', roster: equipo });
    const { generationConfig } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(generationConfig.temperature).toBe(0.3);
    const asignados = generationConfig.responseSchema.properties.schedule.properties.martes.properties.tasks.items.properties.assigned;
    expect(asignados.items.enum).toEqual(['Ana', 'Luis']);
  });

  it('si el modelo rechaza el esquema (400) lo repite sin él antes de rendirse', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', roster: equipo });
    expect(r.generatedJson).toEqual(planOk);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.responseSchema).toBeDefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig.responseSchema).toBeUndefined();
  });

  it('BUG evitado: el prompt no lleva teléfonos, enlaces de Maps ni tarifas del equipo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', roster: equipo, activeWeekData: semanaReal });
    const texto = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(texto).toContain('Boda Uno - Carga');
    expect(texto).not.toMatch(/600000000|maps\/x|37/);
  });

  it('BUG evitado: una tarea hecha sobrevive aunque Gemini la quite o la desmarque', async () => {
    const sinLaHecha = { ...semanaOk, schedule: { martes: { tasks: [{ id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 11:00', assigned: ['Luis'], completed: false }] } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(sinLaHecha)));
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', roster: equipo, activeWeekData: semanaReal });
    expect(r.generatedJson.schedule.martes.tasks[0]).toEqual(semanaReal.schedule.martes.tasks[0]);
  });

  it('una respuesta que no es una semana válida se rechaza', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ hola: 'mundo' })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k' });
    expect(r.generatedJson).toBeNull();
    expect(r.errorMsg).toContain('planificación');
  });
});

describe('validateGeneratedSchedule', () => {
  it('acepta una semana con forma correcta y rechaza formas rotas', () => {
    expect(validateGeneratedSchedule(semanaOk)).toBe('');
    expect(validateGeneratedSchedule(null)).not.toBe('');
    expect(validateGeneratedSchedule([])).not.toBe('');
    expect(validateGeneratedSchedule({ sundayMonday: { tasks: 'no' } })).not.toBe('');
    expect(validateGeneratedSchedule({ saturdaySpecial: { weddings: {} } })).not.toBe('');
  });
});

describe('formato "Evento - Tarea" en la generación', () => {
  it('el prompt pide usar EXACTAMENTE los nombres de evento del usuario y las categorías generales', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [{ day: 'viernes', kind: 'Boda', place: 'Finca Norte', time: '' }, { day: 'martes', kind: 'Evento', place: 'Catering Uno', time: '' }],
    });
    expect(p).toContain('"EVENTO - Tarea"');
    expect(p).toContain('EXACTAMENTE estos nombres de evento: Evento Catering Uno, Boda Finca Norte');
    expect(p).toContain('Logística Preparación');
  });

  it('el prompt de sistema explica el formato con las tres categorías', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k' });
    const texto = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(texto).toContain('FORMATO DEL TEXTO DE CADA TAREA');
    for (const c of ['Logística Preparación', 'Logística Carga', 'Limpieza Eventos']) expect(texto).toContain(`"${c}"`);
    vi.unstubAllGlobals();
  });

  it('si la IA se salta el formato, se completa con el evento conocido o la categoría', async () => {
    const respuesta = { schedule: { martes: { tasks: [{ text: 'Recoger generador de la Finca Norte' }, { text: 'Limpieza de vajilla' }, { text: 'Boda Finca Norte - Supervisión' }] } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(respuesta)));
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', eventNames: ['Boda Finca Norte'] });
    expect(r.generatedJson.schedule.martes.tasks.map(t => t.text)).toEqual([
      'Boda Finca Norte - Recoger generador de la Finca Norte',
      'Limpieza Eventos - Limpieza de vajilla',
      'Boda Finca Norte - Supervisión',
    ]);
    vi.unstubAllGlobals();
  });
});

describe('buildWeekPrompt — pax', () => {
  it('los pax van en la línea del evento (junto al horario) para que la IA dimensione personal y camiones', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [
        { day: 'viernes', kind: 'Boda', place: 'Finca Norte', time: '20:00-00:00', pax: '120' },
        { day: 'martes', kind: 'Evento', place: 'Catering Uno', time: '', pax: 80 },
        { day: 'martes', kind: 'Evento', place: 'Catering Dos', time: '', pax: '' },
      ],
    });
    expect(p).toContain('- Viernes 25: Boda Finca Norte (20:00-00:00, 120 pax).');
    expect(p).toContain('- Martes 22: Evento Catering Uno (80 pax).');
    expect(p).toContain('- Martes 22: Evento Catering Dos.');
  });
});

describe('buildWeekPrompt — recogidas y devoluciones de alquiler', () => {
  it('las recogidas de camiones/generadores llegan al prompt con su día y hora, ordenadas, y sin filas vacías', () => {
    const p = buildWeekPrompt({
      ...base, dayLabel,
      events: [],
      rentals: [
        { day: 'viernes', text: 'Recoger generadores 7K y furgo Albacar', time: '18:00' },
        { day: 'martes', text: ' Devolver material Alquileres Norte ', time: '' },
        { day: 'martes', text: '   ', time: '10:00' },
        { day: 'nunca', text: 'Fantasma', time: '' },
      ],
    });
    expect(p).toContain('- Martes 22: Devolver material Alquileres Norte.');
    expect(p).toContain('- Viernes 25: Recoger generadores 7K y furgo Albacar (18:00).');
    expect(p.indexOf('Martes 22: Devolver')).toBeLessThan(p.indexOf('Viernes 25: Recoger'));
    expect(p).not.toContain('Fantasma');
    expect(p).toContain('Logística Preparación');
  });

  it('sin recogidas no añade nada al prompt', () => {
    expect(buildWeekPrompt({ ...base, dayLabel, events: [], rentals: [] })).not.toContain('Recogidas y devoluciones de alquiler');
  });
});

describe('extraerMemoriaDelPrompt — recuerdos a largo plazo', () => {
  afterEach(() => vi.unstubAllGlobals());
  const responde = (text) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }));

  it('devuelve la regla en una frase (sin comillas) y manda la clave en la cabecera', async () => {
    responde('"Las bodas dobles necesitan más tiempo"');
    expect(await extraerMemoriaDelPrompt({ prompt: 'x', apiKey: 'k' })).toBe('Las bodas dobles necesitan más tiempo');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).not.toContain('k?');
    expect(opts.headers['x-goog-api-key']).toBe('k');
  });

  it('BUG evitado: NO guarda como regla un JSON, un párrafo largo o un NO_MEMORY con adornos', async () => {
    for (const text of ['NO_MEMORY', 'NO_MEMORY.', JSON.stringify({ meta: {} }), 'x'.repeat(301), 'línea uno\nlínea dos']) {
      responde(text);
      expect(await extraerMemoriaDelPrompt({ prompt: 'x', apiKey: 'k' })).toBeNull();
    }
  });

  it('sin texto no llama; si la API (directa o por el servidor) falla, null y sin lanzar', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('sin red'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await extraerMemoriaDelPrompt({ prompt: '  ', apiKey: 'k' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await extraerMemoriaDelPrompt({ prompt: 'x', apiKey: 'k' })).toBeNull();
    expect(await extraerMemoriaDelPrompt({ prompt: 'x', apiKey: ' ' })).toBeNull(); // por el servidor, sin red
  });
});

describe('memoria y aprendizaje en el prompt', () => {
  afterEach(() => vi.unstubAllGlobals());
  const promptEnviado = async (args) => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    await generateScheduleWithGemini({ prompt: 'x', apiKey: 'k', ...args });
    return JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
  };

  it('solo pasa las reglas ACTIVAS (las propuestas esperan a que el admin las apruebe)', async () => {
    const texto = await promptEnviado({ aiMemories: [
      { content: 'Regla aprobada' }, { content: 'Regla nueva activa', estado: 'activa' }, { content: 'Regla sin aprobar', estado: 'propuesta' },
    ] });
    expect(texto).toContain('- Regla aprobada');
    expect(texto).toContain('- Regla nueva activa');
    expect(texto).not.toContain('Regla sin aprobar');
  });

  it('incluye lo aprendido de los fichajes reales', async () => {
    const aprendizaje = { porTipo: [{ tipo: 'Carga', tareas: 4, planificadoMin: 60, realMin: 90, desvioMin: 30 }], porPersona: {} };
    expect(await promptEnviado({ aprendizaje })).toContain('- Carga: planificadas 1 h de media, reales 1 h 30 (+30 min, 4 tareas).');
    expect(await promptEnviado({})).not.toContain('APRENDIZAJE DE LOS FICHAJES');
  });
});
