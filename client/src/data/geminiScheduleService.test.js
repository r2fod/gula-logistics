import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWeekPrompt, generateScheduleWithGemini, validateGeneratedSchedule, GEMINI_MODELS } from './geminiScheduleService';

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

describe('generateScheduleWithGemini — nunca inventa una semana', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('BUG evitado: sin clave NO devuelve una demo con eventos de otra semana, devuelve un error claro', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: '  ' });
    expect(r.generatedJson).toBeNull();
    expect(r.errorMsg).toContain('Falta la clave de Gemini');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain('Evento Especial 3');
  });

  it('con clave devuelve el JSON y manda la clave en la cabecera, no en la URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(semanaOk));
    vi.stubGlobal('fetch', fetchMock);
    const r = await generateScheduleWithGemini({ prompt: 'x', apiKey: 'CLAVE-FALSA' });
    expect(r).toEqual({ generatedJson: semanaOk, errorMsg: '' });
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
    expect(r.generatedJson).toEqual(semanaOk);
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
