// Lógica compartida para pedirle a Gemini que genere/actualice el JSON de
// una semana de planning. Antes vivía duplicada dentro de
// GeminiAssistantModal.jsx; se extrae aquí porque el asistente guiado de
// "Crear Nueva Semana" (WeekManagerModal.jsx) necesita la misma llamada,
// con las mismas reglas de negocio — mantenerlas en dos sitios las habría
// desincronizado en cuanto alguien ajustara una sola copia.
import { EVENT_CATEGORIES, buildEventName } from './eventNaming';
import { semanaParaPrompt, semanaVacia, esquemaPlan, nombresPermitidos, completarPlanGenerado, contextoParaPrompt } from './planificadorIa';
import { limitesDe } from './disponibilidad';
import { textoAprendizajeParaPrompt } from './aprendizajeFichajes';
import { esMemoriaActiva } from './memoriaIa';
import { llamarGeminiEnServidor } from './apiService';

export const GEMINI_API_KEY_STORAGE_KEY = 'gula_gemini_api_key';

// Días y tipos que se pueden elegir al listar los eventos de la semana en el
// asistente de "Crear Nueva Semana" (WeekManagerModal.jsx).
export const WEEK_EVENT_DAYS = [
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
  { key: 'lunes', label: 'Lunes' },
];
export const WEEK_EVENT_KINDS = ['Boda', 'Evento'];

// Prompt del asistente guiado. Los eventos son una lista por día (antes solo
// se preguntaba "cuántas bodas hay el sábado", y una boda de viernes o dos
// eventos de martes no tenían dónde ir). `dayLabel(key)` devuelve el nombre
// del día, con su número si se conoce ("Martes 22").
export function buildWeekPrompt({ weekName, dateRange, trucks = [], workers = [], events = [], rentals = [], extraNotes = '', dayLabel = (k) => k }) {
  const clean = events
    .map(e => ({ ...e, place: (e.place || '').trim(), time: (e.time || '').trim() }))
    .filter(e => WEEK_EVENT_DAYS.some(d => d.key === e.day));
  const order = WEEK_EVENT_DAYS.map(d => d.key);
  clean.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));

  const eventLines = clean.map(e => {
    const pax = Number(e.pax) > 0 ? `${Math.round(Number(e.pax))} pax` : '';
    const detalle = [e.time, pax].filter(Boolean).join(', ');
    return `- ${dayLabel(e.day)}: ${buildEventName(e, dayLabel)}${detalle ? ` (${detalle})` : ''}.`;
  });
  const eventNames = [...new Set(clean.map(e => buildEventName(e, dayLabel)))];
  const hasSaturday = clean.some(e => e.day === 'sabado');

  // Recogidas y devoluciones de alquiler (camiones, generadores, material): no
  // son eventos pero hay que planificarlas como tareas de su día.
  const rentalLines = rentals
    .map(r => ({ ...r, text: (r.text || '').trim(), time: (r.time || '').trim() }))
    .filter(r => r.text && WEEK_EVENT_DAYS.some(d => d.key === r.day))
    .sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day))
    .map(r => `- ${dayLabel(r.day)}: ${r.text}${r.time ? ` (${r.time})` : ''}.`);

  const parts = [
    `Genera la planificación completa de la semana "${weekName}" (${dateRange}).`,
    trucks.length > 0 ? `Camiones disponibles esta semana: ${trucks.join(', ')}.` : 'No hay camiones marcados como disponibles — avisa en las tareas que dependan de reparto de camión.',
    workers.length > 0 ? `Trabajadores disponibles esta semana: ${workers.join(', ')}.` : '',
    eventLines.length > 0
      ? `Bodas y eventos de la semana — para CADA uno planifica (dimensiona personal y camiones según sus pax cuando se indiquen), en el día que toque, la carga (el día anterior o por la mañana), la ruta, la descarga con montaje de estructura y la recogida posterior, repartiendo camiones y personal entre los que coincidan:\n${eventLines.join('\n')}\nLos de sábado van en saturdaySpecial.weddings; los de cualquier otro día se reflejan como tareas de ese día (y de los anteriores si hay que preparar o cargar antes).\nEscribe el texto de cada tarea como "EVENTO - Tarea" usando EXACTAMENTE estos nombres de evento: ${eventNames.join(', ')}. Para la logística que no es de un evento concreto usa "Logística Preparación", "Logística Carga" o "Limpieza Eventos".`
      : 'No hay bodas ni eventos esta semana — planifica solo la operativa de flota, almacén y recogidas.',
    rentalLines.length > 0
      ? `Recogidas y devoluciones de alquiler (camiones, generadores, material) que hay que planificar como tareas de su día, con una sola persona asignada y el camión o furgoneta que haga falta (usa "Logística Preparación" como evento salvo que sean de un evento concreto):\n${rentalLines.join('\n')}`
      : '',
    hasSaturday ? '' : 'El sábado no hay bodas esta semana — no generes saturdaySpecial.weddings, o déjalo vacío.',
    extraNotes.trim() ? `Notas adicionales: ${extraNotes.trim()}` : ''
  ];
  return parts.filter(Boolean).join(' ');
}

function buildSystemPrompt({ semana = null, roster = [], aiMemories = [], aprendizaje = null, disponibles = null }) {
  // Construimos las reglas de negocio dinámicamente basadas en los roles de los trabajadores
  const workerRules = roster.length > 0 ? roster.map(w => {
    const role = w.role.toLowerCase();
    if (role.includes('limpieza')) {
      return `${w.name} SOLO hace limpieza de vajilla y utensilios en eventos, NUNCA cargas, descargas ni montaje de estructura.`;
    }
    if (role.includes('ayudante') || role.includes('apoyo')) {
      return `${w.name} ayuda como apoyo en cargas, descargas y montaje de estructura cuando hace falta.`;
    }
    if (role.includes('jefe')) {
      return `${w.name} (Jefe) NO hace cargas ni descargas manuales regulares, no lo asignes a esas tareas bajo ningún concepto, enfócalo en supervisión.`;
    }
    if (role.includes('conductor')) {
      return `${w.name} es conductor y debe ser asignado preferentemente a cargas, descargas y recogidas que requieran conducción (${w.truck || 'camión'}).`;
    }
    return '';
  }).filter(Boolean).map((rule, idx) => `2.${idx + 1}. ${rule}`).join('\n')
  : '2. Asigna las tareas a los trabajadores correspondientes de forma lógica.';

  // Lo aprendido de los fichajes reales (duraciones y quién hace qué), ver
  // aprendizajeFichajes.js. Antes se miraba la hora del clic en "hecha".
  const historyRule = textoAprendizajeParaPrompt(aprendizaje);

  // Solo las reglas aprobadas: las propuestas por el asistente esperan al admin.
  const activas = aiMemories.filter(esMemoriaActiva);
  const memoryRules = activas.length > 0
    ? `\nPREFERENCIAS DEL USUARIO (MEMORIA A LARGO PLAZO):\n${activas.map(m => `- ${m.content}`).join('\n')}\nTen en cuenta obligatoriamente estas preferencias operativas al asignar o ajustar tareas.`
    : '';

  const plan = semanaParaPrompt(semana);
  const contexto = contextoParaPrompt({ semana, equipo: roster, disponibles });
  const limites = limitesDe(semana);
  const actual = semanaVacia(plan)
    ? 'La semana está vacía: créala entera con lo que pide el usuario.'
    : `PLANIFICACIÓN ACTUAL (las tareas con "completed": true ya están hechas: déjalas exactamente igual):\n${JSON.stringify(plan)}`;

  return `Eres el Asistente Experto en Logística de "Gula Logística" (catering y eventos en Valencia).
${contexto}

REGLAS DE NEGOCIO IMPORTANTES:
1. Para las tareas de RECOGIDA, asigna SIEMPRE a una sola persona, a menos que el usuario pida explícitamente que asigne a dos.
${workerRules}${memoryRules}
3. Al planificar recogidas (especialmente recogidas de camión), prográmalas SIEMPRE por la mañana temprano, a menos que se indique lo contrario.
4. Cuando se descargue en un evento, ten en cuenta que también hay MONTAJE DE ESTRUCTURA. Esto debe reflejarse en el texto y el tiempo estimado de la tarea.
5. Cada tarea lleva por separado el texto (ej: "Recoger material"), el horario "HH:MM - HH:MM" y el lugar (ej: "Alquileres Norte"; en la base, "Almacén Base").
6. Nadie puede estar en dos tareas a la vez: revisa los horarios de cada persona en cada día. Nadie pasa de ${limites.maxHorasDia} h en un día y entre jornadas hay al menos ${limites.descansoMinHoras} h de descanso (tras una boda que acaba de madrugada, esas personas no empiezan temprano al día siguiente). Reparte la carga de forma equilibrada entre el personal disponible.
7. En "sundayMonday.tasks" (domingo y lunes comparten lista) pon SIEMPRE "targetDay": "Domingo" o "Lunes" según el día real de cada tarea.
8. FORMATO DEL TEXTO DE CADA TAREA (de él salen los costes por evento y por persona): "EVENTO - Tarea", con un guion normal entre espacios UNA sola vez. EVENTO es el nombre exacto de la boda o evento (ej. "Boda Ana y Luis", "Evento Catering Norte") cuando la tarea es de ese evento; si es logística general, una de estas categorías: ${EVENT_CATEGORIES.map(c => `"${c}"`).join(', ')} ("Logística Preparación" = recogidas y devoluciones de camión o material, preparación de material, supervisión; "Logística Carga" = cargas de camión; "Limpieza Eventos" = limpieza de vajilla y utensilios). Si una tarea sirve a VARIOS eventos a la vez (ej. una recogida de material para dos bodas), pon los nombres separados por " + " antes del guion: "Boda Ana y Luis + Boda Eva y Pau - Recoger material Alquileres Norte" (su coste se reparte a partes iguales). La parte "Tarea" es corta y concreta, sin guiones con espacios ni horas ni nombres de personas (van en timeFrame y assigned). Ejemplos: "Boda Ana y Luis - Descarga + Montaje Estructura", "Boda Ana y Luis - Recoger generador", "Boda Ana y Luis - Logística Cierre", "Boda Ana y Luis - Supervisión", "Logística Preparación - Recogida Camión Covey", "Logística Preparación - Devolución Alquileres Norte", "Logística Carga - Carga Camión Miércoles", "Limpieza Eventos - Limpieza eventos".
9. Si el usuario pide un cambio, modifica SOLO lo necesario y conserva el resto de la planificación tal cual, con el mismo "id" en las tareas que ya existen.${historyRule}

${actual}

Responde SOLO con JSON con esta forma: {"schedule":{"martes":{"tasks":[...]},"miercoles":{"tasks":[...]},"jueves":{"tasks":[...]},"viernes":{"tasks":[...]}},"saturdaySpecial":{"weddings":[...]},"sundayMonday":{"tasks":[...]}}.
Cada tarea: {"id","text","location","timeFrame","assigned":["nombre exacto"],"truck","event"} ("truck" y "event" solo si hacen falta; en sundayMonday añade "targetDay"). Cada boda del sábado: {"location","truck","details","timeFrame","assigned","event"}. No escribas enlaces de Maps ni el estado de hecha: la app los pone sola.`;
}

// Modelos a probar por orden. El código llevaba `gemini-1.5-flash`, ya retirado
// por Google: la llamada fallaba siempre y el fallback enseñaba una demo.
// `gemini-2.5-flash` es el estable vigente (sin fecha de retirada anunciada) y
// `gemini-flash-latest` es un alias al Flash más reciente, por si el primero
// se retira; `gemini-2.5-flash-lite`, de reserva. Se pasa al siguiente si el modelo
// no existe (404) o si Google dice que está saturado (503, pasa a menudo con Flash).
// El servidor (ia.routes.js) usa la misma lista.
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
const PROBAR_OTRO_MODELO = [404, 503];

// POST a Gemini probando GEMINI_MODELS por orden. La clave va en la cabecera, no en la URL, para que no
// quede en historiales ni registros de red. Devuelve la última Response.
// Sin clave en este navegador se pasa por el servidor (/api/ia/gemini, solo admin),
// que usa la suya (GEMINI_API_KEY en Render): así no hay que pegarla en cada móvil.
async function llamarGemini(apiKey, body) {
  if (!apiKey) return llamarGeminiEnServidor(body);
  let res = null;
  for (const model of GEMINI_MODELS) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body
    });
    if (!PROBAR_OTRO_MODELO.includes(res.status)) break;
  }
  return res;
}

// Lo más largo que se guarda como recuerdo de la IA (el servidor pone el mismo tope).
export const MAX_MEMORIA_IA = 300;

// ¿Expresa el texto del usuario una preferencia general que deba recordarse para
// siempre? Devuelve esa regla en una frase corta o null. Va APARTE de la
// generación (se lanza a la vez, sin retrasarla) y nunca lanza. Todo lo que no
// parezca una frase corta — JSON, párrafos, "NO_MEMORY" con adornos — se descarta:
// lo que se guarda aquí entra en TODOS los prompts futuros como "obligatorio".
export async function extraerMemoriaDelPrompt({ prompt, apiKey }) {
  const clave = (apiKey || '').trim();
  if (!prompt?.trim()) return null;
  const memPrompt = `Analiza el siguiente texto del usuario: "${prompt}".\n¿El usuario está expresando una regla, preferencia o hecho general que debe recordarse a largo plazo para futuras planificaciones? (Ej: "A Luis no le gusta el camión X", "Las bodas dobles necesitan más tiempo").\nSi es así, extrae esa regla como una frase corta y clara. Si es solo una orden puntual para esta semana (Ej: "Pon a Ana mañana", "Quita a Eva del viernes"), responde EXACTAMENTE y únicamente con la palabra: NO_MEMORY.`;
  try {
    const res = await llamarGemini(clave, JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: memPrompt }] }],
      generationConfig: { responseMimeType: 'text/plain' }
    }));
    if (!res?.ok) return null;
    const data = await res.json();
    const texto = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^["'«]|["'»]$/g, '').trim();
    if (!texto || texto.includes('NO_MEMORY') || texto.length > MAX_MEMORIA_IA || /[{}\n]/.test(texto)) return null;
    return texto;
  } catch (e) {
    console.warn('No se pudo extraer un recuerdo del prompt (se sigue sin él):', e);
    return null;
  }
}

// Comprobación mínima de que lo que devolvió la IA tiene forma de semana.
// Devuelve un texto de error, o '' si es válido.
export function validateGeneratedSchedule(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return 'La respuesta de Gemini no tiene el formato esperado.';
  const { schedule, saturdaySpecial, sundayMonday } = json;
  if (!schedule && !saturdaySpecial && !sundayMonday) return 'La respuesta de Gemini no trae ninguna planificación (schedule, sábado o domingo/lunes).';
  if (schedule && (typeof schedule !== 'object' || Array.isArray(schedule))) return 'El campo schedule de la respuesta de Gemini no es válido.';
  if (sundayMonday?.tasks && !Array.isArray(sundayMonday.tasks)) return 'Las tareas de domingo/lunes de la respuesta de Gemini no son una lista.';
  if (saturdaySpecial?.weddings && !Array.isArray(saturdaySpecial.weddings)) return 'Las bodas de la respuesta de Gemini no son una lista.';
  return '';
}

// Devuelve { generatedJson, errorMsg }: en éxito el JSON y errorMsg vacío; en
// cualquier fallo generatedJson es null y errorMsg explica qué pasó — nunca
// lanza. ANTES devolvía una demo con fincas y tareas de una semana pasada
// (sin clave, sin aviso alguno; o tras un error, con un aviso pequeño) y la
// interfaz dejaba "Crear la Semana con esta Planificación": el usuario
// generaba la semana nueva y salía con los eventos de la anterior. Un dato
// inventado que parece real es peor que un error claro.
// Una llamada a Gemini que tiene que devolver JSON: con `esquema` y `extras` (p. ej. el
// tope de razonamiento) y, si el modelo no los acepta (400), otra vez sin ellos.
// → { json, uso: { entrada, respuesta, pensamiento, total } } (tokens). Lanza un Error
// con la pista de qué hacer si falla.
export async function pedirJsonAGemini({ apiKey, texto, esquema = null, temperatura = 0.3, extras = {} }) {
  const clave = (apiKey || '').trim();
  const conAjustes = !!esquema || Object.keys(extras).length > 0;
  const cuerpo = (completo) => JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: temperatura, ...(completo && esquema ? { responseSchema: esquema } : {}), ...(completo ? extras : {}) },
  });

  let res = await llamarGemini(clave, cuerpo(true));
  if (res?.status === 400 && conAjustes) res = await llamarGemini(clave, cuerpo(false));

  if (!res?.ok) {
    const status = res?.status || 0;
    // El motivo real: nuestro servidor lo da como texto ("no tiene clave…") y Google como
    // objeto ({ status: 'UNAVAILABLE', message: 'The model is overloaded' }). Antes todo
    // 503 se tomaba por "falta la clave", también cuando Google estaba saturado.
    let cuerpo = null;
    try { cuerpo = await res?.json?.(); } catch { /* sin cuerpo */ }
    const deGoogle = cuerpo?.error && typeof cuerpo.error === 'object' ? cuerpo.error : null;
    const saturado = status === 503 && (deGoogle?.status === 'UNAVAILABLE' || /overload|unavailable/i.test(deGoogle?.message || ''));
    const delServidor = typeof cuerpo?.error === 'string' ? cuerpo.error : '';
    // 404 sin clave = el servidor aún no tiene /api/ia (Render sin desplegar): mismo remedio.
    const hint = saturado ? ' — Gemini (Google) está saturado ahora mismo: vuelve a probar en un minuto'
      : status === 401 && !clave ? ' — inicia sesión de administrador para usar la clave del servidor'
      : delServidor && !clave ? ` — ${delServidor}`
      : (status === 503 || status === 404) && !clave ? ' — falta la clave de Gemini: pégala en este navegador (botón de la llave) o ponla en el servidor (GEMINI_API_KEY en Render)'
      : status === 400 || status === 403 ? ' — comprueba que la clave es correcta'
      : status === 429 ? ' — demasiadas peticiones, espera un minuto' : '';
    throw new Error(`Error Gemini API (${status})${hint}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La respuesta de Gemini no contenía un JSON válido.');
  const u = data.usageMetadata || {};
  return {
    json: JSON.parse(jsonMatch[0]),
    uso: { entrada: u.promptTokenCount || 0, respuesta: u.candidatesTokenCount || 0, pensamiento: u.thoughtsTokenCount || 0, total: u.totalTokenCount || 0 },
  };
}

export async function generateScheduleWithGemini({ prompt, apiKey, activeWeekData = null, eventNames = null, roster = [], aiMemories = [], aprendizaje = null, disponibles = null }) {
  const systemPrompt = buildSystemPrompt({ semana: activeWeekData, roster, aiMemories, aprendizaje, disponibles });
  const nombres = nombresPermitidos({ equipo: roster, disponibles, semana: activeWeekData });
  const eventos = eventNames || (activeWeekData?.events || []).map(e => e?.name).filter(Boolean);

  try {
    // Con esquema la respuesta es siempre JSON válido y no puede inventarse a nadie;
    // temperatura baja: una planificación se quiere coherente, no creativa.
    const { json: parsed, uso } = await pedirJsonAGemini({ apiKey, texto: `${systemPrompt}\n\nSolicitud del usuario: ${prompt}`, esquema: esquemaPlan(nombres) });
    const invalid = validateGeneratedSchedule(parsed);
    if (invalid) throw new Error(invalid);

    // Hechas intactas, desactivadas conservadas, nombres exactos, ids, Maps y "Evento - Tarea".
    return { generatedJson: completarPlanGenerado(parsed, { original: activeWeekData, equipo: roster, eventNames: eventos }), errorMsg: '', uso };
  } catch (err) {
    console.error(err);
    return {
      generatedJson: null,
      errorMsg: `No se pudo generar con Gemini: ${err.message}. No se ha creado nada; inténtalo de nuevo.`
    };
  }
}
