// Fichajes: leerlos, guardarlos, cambiarlos y su cola sin red (los que se fichan
// sin cobertura esperan aquí hasta que el servidor los confirma).
import { API_BASE, fetchConLimite } from './servidor';
import { authHeaders, tokenTrabajador } from './accesos';

// Con qué se piden los fichajes: la sesión (admin o socias) y, si se sabe de quién es
// este móvil, su enlace personal. Cuando el admin exige el enlace, el servidor solo da
// todos a una sesión y, a un trabajador, los suyos. Sin nada que mandar no se añade
// ninguna cabecera: la petición sigue siendo de las que el navegador no pregunta antes.
function cabecerasDeLectura(trabajador) {
  const enlace = trabajador ? tokenTrabajador(trabajador) : null;
  return { ...authHeaders(), ...(enlace ? { 'X-Enlace': enlace } : {}) };
}
const opcionesDeLectura = (trabajador) => {
  const headers = cabecerasDeLectura(trabajador);
  return Object.keys(headers).length ? { headers } : undefined;
};

// Qué fichajes dio el servidor la última vez que se le pidieron todos: 'todos' |
// 'propios' (los de quien lleva este móvil) | 'ninguna' (hace falta el enlace personal
// o una sesión) | null (aún no se sabe). Un servidor anterior no lo dice: 'todos'.
let lecturaDeFichajes = null;
export const accesoAFichajes = () => lecturaDeFichajes;

/**
 * Fetch all clock entries from MongoDB / Backend API
 * `trabajador`: de quién es este móvil (su enlace personal va en la petición).
 */
export async function fetchClockEntriesFromAPI(trabajador = null) {
  try {
    const opciones = opcionesDeLectura(trabajador);
    const res = await (opciones ? fetchConLimite(`${API_BASE}/clock`, opciones) : fetchConLimite(`${API_BASE}/clock`));
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      lecturaDeFichajes = res.headers?.get?.('X-Lectura') || 'todos';
      // Fusionar con lo que siga pendiente de sincronizar (fichado sin
      // cobertura, ver saveClockEntryToAPI) en vez de sobrescribirlo a
      // ciegas — si no, en cuanto volvía la conexión este GET traía la
      // lista de Mongo (que todavía no incluye ese fichaje) y lo borraba
      // sin dejar rastro, tanto del estado como del propio localStorage.
      const pendingAll = getPendingClockEntries();
      const pending = pendingAll.filter(p => !data.some(d => d.id === p.id));
      if (pending.length !== pendingAll.length) {
        // Alguno de los pendientes ya está confirmado en el servidor
        // (llegó por otra vía, ej. retryPendingClockEntries) — sacarlo de
        // la cola para no reintentarlo de más.
        setPendingClockEntries(pending);
      }
      const merged = pending.length > 0 ? [...data, ...pending] : data;
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Backend API disconnected, using localStorage fallback for clock entries:', err.message);
  }
  
  // Fallback to local storage
  try {
    const saved = localStorage.getItem('gula_clock_entries_v1');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Solo los fichajes creados o cambiados desde `desde` (fecha ISO del servidor,
// ver ultimaModificacion). null si no se pudo preguntar: quien llama sigue con
// lo que tiene y lo reintenta en el siguiente ciclo.
export async function fetchClockEntryChangesFromAPI(desde, trabajador = null) {
  try {
    const url = `${API_BASE}/clock?desde=${encodeURIComponent(desde)}`;
    const opciones = opcionesDeLectura(trabajador);
    const res = await (opciones ? fetchConLimite(url, opciones) : fetchConLimite(url));
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

// Copia local de los fichajes para abrir sin red (la misma que deja fetchClockEntriesFromAPI).
export function guardarCopiaFichajes(fichajes) {
  try {
    localStorage.setItem('gula_clock_entries_v1', JSON.stringify(fichajes));
  } catch {
    // Sin espacio o en modo privado: la copia es solo una ayuda.
  }
}

/**
 * Create new clock entry in MongoDB / Backend API
 */
// Fichajes que se crearon en el cliente pero no se ha confirmado que
// llegaran al servidor (sin cobertura, típico en fincas de boda, o con el
// servidor caído). Antes se perdían en silencio: en cuanto volvía la
// cobertura, el polling de 20s traía la lista de Mongo (sin ese fichaje) y
// SOBRESCRIBÍA tanto el estado como el propio localStorage con ella. Esta
// cola aparte + retryPendingClockEntries() es lo que evita perderlos.
const PENDING_CLOCK_SYNC_KEY = 'gula_pending_clock_sync_v1';

function getPendingClockEntries() {
  try {
    const saved = localStorage.getItem(PENDING_CLOCK_SYNC_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function setPendingClockEntries(list) {
  try {
    localStorage.setItem(PENDING_CLOCK_SYNC_KEY, JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

// Fichajes todavía sin confirmar que hay que fusionar con lo que traiga el
// servidor (en vez de dejar que el poll los borre). Ver App.jsx.
export function getPendingClockEntriesSnapshot() {
  return getPendingClockEntries();
}

/**
 * Create new clock entry in MongoDB / Backend API. Devuelve el documento
 * guardado si funciona, `{ rechazado: motivo }` si el servidor exige el enlace
 * personal y no lo trae (no se reintenta: no serviría), o `null` si no se pudo
 * (el fichaje queda en la cola de pendientes para reintentarlo, no se pierde).
 */
// Cabeceras de un fichaje: la sesión de admin (deja apuntar fechas antiguas) y el
// enlace personal de esa persona si este móvil lo tiene (el fichaje va firmado).
function cabecerasDeFichaje(entry) {
  const enlace = tokenTrabajador(entry.workerName);
  return { 'Content-Type': 'application/json', ...authHeaders(), ...(enlace ? { 'X-Enlace': enlace } : {}) };
}

// Un fichaje que el servidor no va a aceptar por mucho que se reintente: 400 (fecha
// imposible, persona fuera del equipo…), 413 (demasiado grande) o 401 por falta del
// enlace personal. Devuelve el motivo, o null si vale la pena reintentarlo.
async function rechazoDefinitivo(res) {
  if (![400, 401, 413].includes(res.status)) return null;
  const datos = await res.json().catch(() => ({}));
  if (res.status === 401 && datos.codigo !== 'ENLACE_REQUERIDO') return null;
  return datos.error || `El servidor no lo acepta (HTTP ${res.status}).`;
}

export async function saveClockEntryToAPI(entry) {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock`, {
      method: 'POST',
      headers: cabecerasDeFichaje(entry),
      body: JSON.stringify(entry)
    });
    // Antes solo el 401: un 400 se encolaba como si no hubiera red y el fichaje se veía
    // hecho en el móvil sin llegar nunca al servidor.
    const motivo = await rechazoDefinitivo(res);
    if (motivo) return { rechazado: motivo };
    if (res.ok) {
      // Por si este fichaje ya estaba en la cola de una sesión/pestaña
      // anterior y ahora se guarda por la vía normal.
      setPendingClockEntries(getPendingClockEntries().filter(e => e.id !== entry.id));
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API disconnected, saving clock entry to localStorage fallback:', err.message);
  }
  const pending = getPendingClockEntries();
  if (!pending.some(e => e.id === entry.id)) {
    setPendingClockEntries([...pending, entry]);
  }
  return null;
}

/**
 * Reintenta guardar cada fichaje pendiente de sincronizar. El servidor es
 * idempotente por `id` (índice único en ClockEntry — ver clock.routes.js),
 * así que reintentar uno que en realidad SÍ se guardó la primera vez (solo
 * que la respuesta no llegó) nunca lo duplica, solo confirma que ya existe.
 * Se llama desde el polling normal de App.jsx y al recuperar conexión.
 */
export async function retryPendingClockEntries() {
  const pending = getPendingClockEntries();
  if (pending.length === 0) return [];

  const synced = [];
  const fuera = new Set(); // guardados o rechazados para siempre
  for (const entry of pending) {
    try {
      const res = await fetchConLimite(`${API_BASE}/clock`, {
        method: 'POST',
        headers: cabecerasDeFichaje(entry),
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        synced.push(entry);
        fuera.add(entry.id);
      } else if (res.status !== 401 && await rechazoDefinitivo(res)) {
        // No va a entrar nunca: fuera de la cola. Antes se reintentaba cada 20 s para
        // siempre y gastaba el límite por IP de todos los que fichan desde esa red.
        // Un 401 por falta del enlace NO: tras anular los enlaces, en cuanto la persona
        // abre el nuevo este reintento ya lo lleva y entra (se perdería su salida).
        console.warn('Fichaje pendiente rechazado por el servidor, sale de la cola:', entry.id);
        fuera.add(entry.id);
      }
    } catch { /* sigue en la cola */ }
  }
  // La cola se vuelve a leer: mientras se reintentaba (hasta 60 s por petición) pudo
  // entrar otro fichaje sin red. Pisarla con la lista del principio lo perdía.
  setPendingClockEntries(getPendingClockEntries().filter(e => !fuera.has(e.id)));
  return synced;
}

/**
 * Update existing clock entry in MongoDB / Backend API
 */
export async function updateClockEntryInAPI(entry) {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API update failed:', err.message);
  }
  // null (no el `entry` echoado) para que quien llama pueda distinguir un
  // guardado real del servidor de un fallo silencioso — antes esta función
  // devolvía el mismo `entry` tanto si se guardaba como si no, así que el
  // llamador no tenía forma de saber si de verdad se había guardado.
  return null;
}

/**
 * Delete clock entry in MongoDB / Backend API
 */
export async function deleteClockEntryInAPI(entryId) {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock/${entryId}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
    return res.ok;
  } catch (err) {
    console.warn('Backend API delete failed:', err.message);
    return false;
  }
}

/**
 * Restore clock entry in MongoDB / Backend API
 */
export async function restoreClockEntryInAPI(entryId) {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock/${entryId}/restore`, {
      method: 'PUT',
      headers: { ...authHeaders() }
    });
    return res.ok;
  } catch (err) {
    console.warn('Backend API restore failed:', err.message);
    return false;
  }
}

// Vacía la papelera de fichajes: los borra de la base PARA SIEMPRE (ya no se pueden
// restaurar). { ok, borrados } — borrados null si el servidor aún no lo dice.
export async function vaciarPapeleraEnAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/optimize`, {
      method: 'POST',
      headers: { ...authHeaders() }
    });
    if (!res.ok) return { ok: false };
    const datos = await res.json().catch(() => ({}));
    return { ok: true, borrados: Number.isFinite(datos.borrados) ? datos.borrados : null };
  } catch (err) {
    console.warn('No se pudo vaciar la papelera:', err.message);
    return { ok: false };
  }
}
