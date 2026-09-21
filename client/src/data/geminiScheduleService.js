// Lógica compartida para pedirle a Gemini que genere/actualice el JSON de
// una semana de planning. Antes vivía duplicada dentro de
// GeminiAssistantModal.jsx; se extrae aquí porque el asistente guiado de
// "Crear Nueva Semana" (WeekManagerModal.jsx) necesita la misma llamada,
// con las mismas reglas de negocio — mantenerlas en dos sitios las habría
// desincronizado en cuanto alguien ajustara una sola copia.
import { EVENT_CATEGORIES, buildEventName, normalizeGeneratedEvents } from './eventNaming';

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

function buildSystemPrompt(activeWeekData) {
  return `Eres el Asistente Experto en Logística de "Gula Logística".
REGLAS DE NEGOCIO IMPORTANTES:
1. Para las tareas de RECOGIDA, asigna SIEMPRE a una sola persona, a menos que el usuario pida explícitamente que asigne a dos.
2. Irene y Raúl NO hacen cargas ni descargas, NO los asignes a esas tareas bajo ningún concepto. Jose y Kerly SOLO hacen limpieza de vajilla y utensilios en eventos, NUNCA cargas, descargas ni montaje de estructura. Jeferson SÍ ayuda como apoyo en cargas, descargas y montaje de estructura cuando hace falta.
3. Al planificar recogidas (especialmente recogidas de camión), prográmalas SIEMPRE por la mañana temprano, a menos que se indique lo contrario.
4. Cuando se descargue en un evento, ten en cuenta que también hay MONTAJE DE ESTRUCTURA. Esto debe reflejarse en el texto y el tiempo estimado de la tarea.
5. Genera las tareas como OBJETOS, intentando siempre separar el texto de la tarea (ej: "Recoger material") del horario (ej: "09:00 - 11:30") y de la ubicación (ej: "Alquileres Norte").
6. Para cada tarea, si es fuera de la base, GENERA UN ENLACE DE GOOGLE MAPS válido para la ubicación usando este formato exacto: "https://www.google.com/maps/search/?api=1&query=Nombre+Del+Sitio". Si es en la base, déjalo vacío "".
7. En "sundayMonday.tasks" (domingo y lunes comparten lista) pon SIEMPRE "targetDay": "Domingo" o "Lunes" según el día real de cada tarea; sin él la app no sabe a qué día pertenece.
8. FORMATO DEL TEXTO DE CADA TAREA (de él salen los costes por evento y por persona): "EVENTO - Tarea", con un guion normal entre espacios UNA sola vez. EVENTO es el nombre exacto de la boda o evento (ej. "Boda Ana y Luis", "Evento Catering Norte") cuando la tarea es de ese evento; si es logística general, una de estas categorías: ${EVENT_CATEGORIES.map(c => `"${c}"`).join(', ')} ("Logística Preparación" = recogidas y devoluciones de camión o material, preparación de material, supervisión; "Logística Carga" = cargas de camión; "Limpieza Eventos" = limpieza de vajilla y utensilios). Si una tarea sirve a VARIOS eventos a la vez (ej. una recogida de material para dos bodas), pon los nombres separados por " + " antes del guion: "Boda Ana y Luis + Boda Eva y Pau - Recoger material Alquileres Norte" (su coste se reparte a partes iguales). La parte "Tarea" es corta y concreta, sin guiones con espacios ni horas ni nombres de personas (van en timeFrame y assigned). Ejemplos: "Boda Ana y Luis - Descarga + Montaje Estructura", "Boda Ana y Luis - Recoger generador", "Boda Ana y Luis - Logística Cierre", "Boda Ana y Luis - Supervisión", "Logística Preparación - Recogida Camión Covey", "Logística Preparación - Devolución Alquileres Norte", "Logística Carga - Carga Camión Miércoles", "Limpieza Eventos - Limpieza eventos".
9. Te pasaré la SEMANA ACTUAL en formato JSON. Si el usuario te pide un cambio o ajuste, MODIFICA el JSON actual de forma inteligente, preservando lo que no cambie, y devuelve el JSON completo actualizado.

Este es el JSON ACTUAL de la semana (únelo con los cambios que pide el usuario):
${JSON.stringify(activeWeekData || {}, null, 2)}

Genera una respuesta EXCLUSIVAMENTE en formato JSON válido sin texto previo ni posterior, con TODAS LAS CLAVES ORIGINALES Y TUS CAMBIOS, siguiendo esta estructura exacta:
{
  "meta": { "week": "Semana X", "dateRange": "Fechas", "status": "Operativa Activa" },
  "schedule": {
    "martes": { "title": "Martes", "badge": "Arranque", "tasks": [{ "id": "m1", "text": "Texto", "location": "Alquileres Norte", "timeFrame": "09:00 - 11:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Alquileres Norte", "assigned": ["Gonzalo"], "completed": false }] },
    "miercoles": { "title": "Miércoles", "badge": "Pre-carga", "tasks": [...] },
    "jueves": { "title": "Jueves", "badge": "Eventos", "tasks": [...] },
    "viernes": { "title": "Viernes", "badge": "Cierre", "tasks": [...] }
  },
  "saturdaySpecial": {
    "title": "Sábado — Eventos Simultáneos",
    "weddings": [{ "location": "Lugar", "truck": "Camión X", "details": "Detalles", "timeFrame": "10:00 - 02:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Lugar", "assigned": ["Gonzalo"] }]
  },
  "sundayMonday": {
    "title": "Domingo & Lunes — Logística Inversa",
    "tasks": [{ "id": "sl1", "text": "Texto", "location": "Almacén", "timeFrame": "09:00 - 14:00", "mapsUrl": "", "assigned": ["Jeferson"], "targetDay": "Domingo", "completed": false }]
  }
}`;
}

// Modelos a probar por orden. El código llevaba `gemini-1.5-flash`, ya retirado
// por Google: la llamada fallaba siempre y el fallback enseñaba una demo.
// `gemini-2.5-flash` es el estable vigente (sin fecha de retirada anunciada) y
// `gemini-flash-latest` es un alias al Flash más reciente, por si el primero
// se retira: solo se pasa al siguiente si el modelo no existe (404).
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];

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
export async function generateScheduleWithGemini({ prompt, apiKey, activeWeekData, eventNames = [] }) {
  // Sin fallback a import.meta.env.VITE_GEMINI_API_KEY a propósito:
  // cualquier variable con prefijo VITE_ se compila tal cual en el JS
  // público del bundle (GitHub Pages), así que un "default" ahí
  // filtraría la clave a cualquiera que inspeccione el bundle en cuanto
  // se configurara y desplegara. La única clave válida es la que cada
  // admin pega a mano en este mismo navegador (persistida solo en su
  // localStorage, nunca compilada).
  const activeApiKey = (apiKey || '').trim();

  if (!activeApiKey) {
    return {
      generatedJson: null,
      errorMsg: 'Falta la clave de Gemini en este dispositivo (se guarda solo en este navegador, así que hay que pegarla en cada móvil u ordenador). Pégala en el campo de arriba y vuelve a generar. No se ha creado nada.'
    };
  }

  const systemPrompt = buildSystemPrompt(activeWeekData);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nSolicitud del usuario: ${prompt}` }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });

  try {
    let res = null;
    for (const model of GEMINI_MODELS) {
      // La clave va en la cabecera (no en la URL) para que no quede en
      // historiales ni registros de red.
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': activeApiKey },
        body
      });
      if (res.status !== 404) break;
    }

    if (!res.ok) {
      const hint = res.status === 400 || res.status === 403 ? ' — comprueba que la clave es correcta' : res.status === 429 ? ' — demasiadas peticiones, espera un minuto' : '';
      throw new Error(`Error Gemini API (${res.status})${hint}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La respuesta de Gemini no contenía un JSON válido.');

    const parsed = JSON.parse(jsonMatch[0]);
    const invalid = validateGeneratedSchedule(parsed);
    if (invalid) throw new Error(invalid);

    // Si la IA se salta el formato "Evento - Tarea", se completa aquí.
    return { generatedJson: normalizeGeneratedEvents(parsed, eventNames), errorMsg: '' };
  } catch (err) {
    console.error(err);
    return {
      generatedJson: null,
      errorMsg: `No se pudo generar con Gemini: ${err.message}. No se ha creado nada; inténtalo de nuevo.`
    };
  }
}
