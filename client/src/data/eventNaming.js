// Nombres de EVENTO de las tareas — para el desglose de costes por evento y
// por persona (pestaña Resumen Financiero), igual que la hoja de planing:
// columnas Evento / Tarea, con eventos tipo "Boda Ana y Luis" y las
// categorías generales "Logística Preparación", "Logística Carga" y
// "Limpieza Eventos".
//
// Convención de la app (ya la usaba el editor de admin, "Nombre del Evento"):
// el texto de la tarea es "EVENTO - Tarea", con un guion normal entre
// espacios. El desglose agrupaba por lo que va antes del guion, pero como la
// IA escribía textos libres ("Recoger Sillas Carvillo — 90 sillas…") cada
// tarea acababa siendo su propio "evento": 31 líneas distintas en vez de unas
// pocas. Aquí está esa lógica en UN sitio.

export const EVENT_CATEGORIES = ['Logística Preparación', 'Logística Carga', 'Limpieza Eventos'];
export const GENERAL_EVENT = 'Tareas Internas';
const DEFAULT_CATEGORY = 'Logística Preparación';

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Categoría general a la que pertenece un texto sin evento propio.
// Devuelve null si ninguna palabra clave encaja.
export function inferCategory(text) {
  const t = plain(text);
  if (/limpieza|vajilla|higieniz/.test(t)) return 'Limpieza Eventos';
  if (/descarg|montaje/.test(t)) return DEFAULT_CATEGORY; // "descarga" contiene "carga": se mira antes
  if (/\bcarg(a|ar|ado|ando|amos)\b|estiba|precint/.test(t)) return 'Logística Carga';
  if (/recog|recoger|devoluc|preparaci|supervis|organiz|checklist|albaran/.test(t)) return DEFAULT_CATEGORY;
  return null;
}

// Separa un nombre de tarea (o de fichaje) en { eventName, specificTaskName,
// explicit }. `explicit` es true solo si el texto trae "Evento - Tarea".
// Sin evento explícito se infiere cuando es seguro (fichajes de boda
// "Boda: Finca (Camión)", textos que empiezan por "Boda X"/"Evento X",
// limpieza, carga…) y, si no, el texto entero es su propio evento, como antes.
export function parseEventAndTask(taskName) {
  // Se quita el horario que el trabajador ve pegado al fichar ("… (12:00-16:00)").
  const text = String(taskName || '').replace(/\s*\(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\)\s*$/, '').trim();
  if (!text) return { eventName: 'Sin Asignar', specificTaskName: 'Tarea General', explicit: false };

  // Solo el guion normal entre espacios: las rayas largas (—, –) se usan en
  // los textos libres para añadir una descripción, no para separar un evento.
  const explicit = text.match(/^(.+?)\s+-\s+(.+)$/s);
  if (explicit && explicit[1].trim() && explicit[2].trim()) {
    return { eventName: explicit[1].trim(), specificTaskName: explicit[2].trim(), explicit: true };
  }

  if (/^(inicio de jornada|jornada( laboral)?|sin asignar.*)$/i.test(text)) {
    return { eventName: GENERAL_EVENT, specificTaskName: text, explicit: false };
  }

  // Fichaje de una boda del sábado: "Boda: Finca Norte, 35, … (Camión Gula)"
  const wedding = text.match(/^boda:\s*(.+)$/i);
  if (wedding) {
    const place = wedding[1].replace(/\s*\((?:cami[oó]n|furgo)[\s\S]*$/i, '').split(',')[0].trim();
    if (place) return { eventName: `Boda ${place}`, specificTaskName: text, explicit: false };
  }

  // Empieza por "Boda X" / "Evento X": el evento es hasta la primera raya, coma, dos puntos o paréntesis.
  const leading = text.match(/^(boda|evento)\s+(.+?)(?:\s+[—–-]\s+|\s*[,:(]|$)/i);
  if (leading && leading[2].trim()) {
    const kind = leading[1][0].toUpperCase() + leading[1].slice(1).toLowerCase();
    return { eventName: `${kind} ${leading[2].trim()}`, specificTaskName: text, explicit: false };
  }

  const category = inferCategory(text);
  if (category) return { eventName: category, specificTaskName: text, explicit: false };

  return { eventName: text, specificTaskName: 'Tarea General', explicit: false };
}

// Nombre de evento de un nombre de tarea/fichaje.
export const getEventName = (taskName) => parseEventAndTask(taskName).eventName;

// Una tarea puede servir a VARIOS eventos a la vez (ej. recoger material en
// Dealde para dos bodas). Se escriben separados por " + " antes del guion:
// "Boda Ana y Luis + Boda Eva y Pau - Recoger material Dealde". También se
// entiende "Boda A y Boda B" (así se escribió antes de existir el separador):
// una " y " solo separa si lo que sigue empieza por "Boda" o "Evento", para no
// partir "Boda Ana y Luis". Devuelve la lista de eventos sin vacíos.
export function splitEventNames(eventName) {
  return String(eventName || '')
    .split(/\s+\+\s+|\s+y\s+(?=(?:boda|evento)\s)/i)
    .map(n => n.trim())
    .filter(Boolean);
}

// Nombres de los eventos de la semana tal como los escribe el usuario en el
// asistente de nueva semana: "Boda Finca Norte". Sin lugar, se usa el día.
export function buildEventName(event, dayLabel = (k) => k) {
  const kind = (event.kind || 'Evento').trim();
  const place = (event.place || '').trim();
  return place ? `${kind} ${place}` : `${kind} del ${dayLabel(event.day)}`;
}

// Devuelve una copia del JSON generado por la IA en la que TODA tarea lleva
// "Evento - Tarea". La IA a veces se salta el formato: aquí se le pone el
// evento conocido cuyo nombre o lugar aparezca en el texto, o si no la
// categoría general que le corresponda. No muta la entrada.
export function normalizeGeneratedEvents(json, knownEventNames = []) {
  if (!json || typeof json !== 'object') return json;

  const known = knownEventNames
    .filter(Boolean)
    .map(name => ({ name, full: plain(name), place: plain(name.replace(/^(boda|evento)\s+/i, '')) }));

  const withEvent = (text) => {
    if (typeof text !== 'string' || !text.trim()) return text;
    if (parseEventAndTask(text).explicit) return text;
    const t = plain(text);
    // Todos los eventos conocidos que aparecen en el texto (una recogida para
    // dos bodas nombra las dos): se unen con " + " y el coste se reparte.
    const hits = known.filter(k => t.includes(k.full) || (k.place.length >= 3 && t.includes(k.place)));
    const event = hits.length > 0 ? hits.map(k => k.name).join(' + ') : (inferCategory(text) || DEFAULT_CATEGORY);
    return `${event} - ${text.trim()}`;
  };

  const fixTasks = (list) => (Array.isArray(list) ? list.map(t => (t && typeof t === 'object' ? { ...t, text: withEvent(t.text) } : t)) : list);

  const out = { ...json };
  if (json.schedule && typeof json.schedule === 'object') {
    out.schedule = Object.fromEntries(Object.entries(json.schedule).map(([day, d]) => [day, d && typeof d === 'object' ? { ...d, tasks: fixTasks(d.tasks) } : d]));
  }
  if (json.sundayMonday && typeof json.sundayMonday === 'object') {
    out.sundayMonday = { ...json.sundayMonday, tasks: fixTasks(json.sundayMonday.tasks) };
  }
  return out;
}

// Eventos ya usados en las tareas de una semana + las categorías generales,
// para sugerirlos al editar (evita variantes como "Boda soto" / "Boda Soto").
export function collectEventNames(weekData) {
  const names = new Set();
  const add = (list) => (list || []).forEach(t => {
    const text = t && typeof t === 'object' ? t.text : t;
    const parsed = parseEventAndTask(text);
    if (parsed.explicit) splitEventNames(parsed.eventName).forEach(n => names.add(n));
  });
  Object.values(weekData?.schedule || {}).forEach(d => add(d?.tasks));
  add(weekData?.sundayMonday?.tasks);
  EVENT_CATEGORIES.forEach(c => names.add(c));
  return [...names];
}
