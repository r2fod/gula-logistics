// Central API Client for Gula Logistics Backend & MongoDB Atlas
import { initialBalancesData } from './balancesData';
import { seguirPeticion } from './servidorLento';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Toda petición al servidor tiene un tiempo máximo. Sin él, una que se quedaba
// colgada (p. ej. en una conexión que el servidor ya había cerrado: el navegador no
// repite un POST por su cuenta) dejaba la pantalla "Generando enlace…" o "Guardando"
// para siempre. Pasado el tiempo, falla como si no hubiera red (y cada llamada hace
// lo que ya hacía sin red: un fichaje, por ejemplo, queda en la cola de pendientes).
// 60 s por defecto: más de lo que tarda en despertar el servidor dormido de Render.
export const ESPERA_MAXIMA_MS = 60 * 1000;
// Las de tiempo normal cuentan para el aviso «Despertando el servidor» (servidorLento.js);
// las largas a propósito (Gemini, subir un PDF), no.
export function fetchConLimite(url, opciones = {}, ms = ESPERA_MAXIMA_MS) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ms);
  const peticion = fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(reloj));
  return ms === ESPERA_MAXIMA_MS ? seguirPeticion(peticion) : peticion;
}

const TOKEN_STORAGE_KEY = 'gula_admin_token_v1';
// Enlace de socias: token firmado de SOLO LECTURA (saldos y panel), aparte de
// la sesión de admin. Lo genera el admin (crearTokenSociasEnAPI) y llega en la URL.
const SOCIAS_TOKEN_STORAGE_KEY = 'gula_socias_token_v1';
// Enlace firmado de un trabajador (?worker=Nombre&t=…): solo le deja ver SU saldo.
// Se guarda con su nombre para no enseñárselo a otra persona que use el mismo móvil.
const TRABAJADOR_TOKEN_STORAGE_KEY = 'gula_trabajador_token_v1';
const BALANCES_CACHE_KEY = 'gula_balances_data_v1';

function leerTokenGuardado(clave) {
  try {
    const raw = localStorage.getItem(clave);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() > expiresAt) {
      localStorage.removeItem(clave);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Admin session token helpers (backed by the server, not a hardcoded password)
 */
export function getStoredAdminToken() {
  return leerTokenGuardado(TOKEN_STORAGE_KEY);
}

export function setStoredAdminToken(token, expiresAt) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
}

export function clearStoredAdminToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredSociasToken() {
  return leerTokenGuardado(SOCIAS_TOKEN_STORAGE_KEY);
}

// Guarda el token de un enlace de socias con su caducidad real (va dentro del
// token; el servidor es quien la hace cumplir, esto solo evita guardar de más).
// Caducidad que lleva dentro un token firmado (ms), o `porDefecto` si no se lee.
function caducidadDeToken(token, porDefecto) {
  try {
    const cuerpo = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    if (Number.isFinite(cuerpo.exp)) return cuerpo.exp;
  } catch { /* token raro: se guarda con la caducidad por defecto y el servidor decide */ }
  return porDefecto;
}

export function setStoredSociasToken(token) {
  const expiresAt = caducidadDeToken(token, Date.now() + 90 * 24 * 60 * 60 * 1000);
  localStorage.setItem(SOCIAS_TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
}

export function guardarTokenTrabajador(nombre, token) {
  try {
    const expiresAt = caducidadDeToken(token, Date.now() + 365 * 24 * 60 * 60 * 1000);
    const key = String(nombre).trim().toLowerCase();
    const raw = localStorage.getItem(TRABAJADOR_TOKEN_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    
    // Migración transparente si había un solo token viejo
    if (map.token && typeof map.token === 'string') {
      const oldMap = {};
      if (map.nombre) oldMap[String(map.nombre).trim().toLowerCase()] = map;
      localStorage.setItem(TRABAJADOR_TOKEN_STORAGE_KEY, JSON.stringify({ ...oldMap, [key]: { token, expiresAt, nombre } }));
    } else {
      map[key] = { token, expiresAt, nombre };
      localStorage.setItem(TRABAJADOR_TOKEN_STORAGE_KEY, JSON.stringify(map));
    }
  } catch { /* sin almacenamiento: vale mientras esté abierta, con el ?t= de la URL */ }
}

export function olvidarTokenTrabajador(nombre) {
  try {
    const raw = localStorage.getItem(TRABAJADOR_TOKEN_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    
    if (map.token && typeof map.token === 'string') {
      if (!nombre || mismoNombre(map.nombre, nombre)) localStorage.removeItem(TRABAJADOR_TOKEN_STORAGE_KEY);
    } else if (nombre) {
      const key = String(nombre).trim().toLowerCase();
      delete map[key];
      localStorage.setItem(TRABAJADOR_TOKEN_STORAGE_KEY, JSON.stringify(map));
    } else {
      localStorage.removeItem(TRABAJADOR_TOKEN_STORAGE_KEY);
    }
  } catch { /* nada que borrar */ }
}

const mismoNombre = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// El enlace firmado de `nombre` en este navegador: el guardado o, recién abierto, el
// ?t= de la URL (App lo guarda y lo quita de la barra de direcciones al arrancar).
export function tokenTrabajador(nombre) {
  try {
    const raw = localStorage.getItem(TRABAJADOR_TOKEN_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      const key = String(nombre).trim().toLowerCase();
      let guardado = null;
      
      if (map.token && typeof map.token === 'string') {
        if (mismoNombre(map.nombre, nombre)) guardado = map;
      } else if (map[key]) {
        guardado = map[key];
      }
      
      if (guardado) {
        if (!guardado.token || !guardado.expiresAt || Date.now() > guardado.expiresAt) {
          olvidarTokenTrabajador(nombre);
        } else {
          return guardado.token;
        }
      }
    }
  } catch { /* sin almacenamiento: se mira la URL */ }
  const params = new URLSearchParams(window.location.search);
  return params.get('t') && mismoNombre(params.get('worker'), nombre) ? params.get('t') : null;
}

// Cierra cualquier acceso de este navegador (admin y socias) y borra la copia
// local de los saldos, para que no queden en un dispositivo compartido.
export function cerrarAccesosGuardados() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(SOCIAS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(BALANCES_CACHE_KEY);
  localStorage.removeItem('gula_mi_saldo_v1');
}

// La sesión de admin manda; si no la hay, el enlace de socias (solo sirve para
// lecturas: el servidor rechaza con él todo lo que escribe).
function authHeaders() {
  const token = getStoredAdminToken() || getStoredSociasToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Admin: genera un enlace de socias nuevo. `anularAnteriores` deja sin efecto
// todos los ya enviados. Devuelve { ok, token, expiresAt } o { ok: false, error }.
// Responde en décimas de segundo: si en 15 s no hay nada, la petición se quedó
// colgada y se repite una vez (pedir otro sin anular no cambia nada en el servidor;
// anular no se repite solo).
export async function crearTokenSociasEnAPI({ anularAnteriores = false } = {}) {
  const intentos = anularAnteriores ? 1 : 2;
  for (let intento = 1; ; intento++) {
    try {
      const res = await fetchConLimite(`${API_BASE}/auth/socias-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ anularAnteriores })
      }, 15 * 1000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `Error ${res.status}` };
      return { ok: true, token: data.token, expiresAt: data.expiresAt };
    } catch {
      if (intento >= intentos) return { ok: false, error: 'el servidor no ha respondido. Prueba otra vez.' };
    }
  }
}

// Admin: el enlace firmado de cada ficha de Saldos, [{ id, name, token }].
// `anularAnteriores` deja sin efecto todos los ya enviados.
export async function crearEnlacesTrabajadoresEnAPI({ anularAnteriores = false } = {}) {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/enlaces-trabajadores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ anularAnteriores })
    }, 20 * 1000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Error ${res.status}` };
    return { ok: true, enlaces: Array.isArray(data.enlaces) ? data.enlaces : [] };
  } catch {
    return { ok: false, error: 'el servidor no ha respondido. Prueba otra vez.' };
  }
}

// La ficha de Saldos del trabajador de ese enlace firmado (solo la suya).
// { ok, ficha } | { ok: false, status } (401: enlace anulado o caducado; 0: sin red).
export async function fetchMiSaldoFromAPI(token) {
  try {
    const res = await fetchConLimite(`${API_BASE}/balances/mio`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, ficha: await res.json() };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ¿Sigue valiendo el acceso de este navegador? 'admin' | 'socias' | null (no vale)
// | undefined (no se pudo comprobar: sin red o servidor dormido; no se cierra nada).
export async function comprobarSesionEnAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/sesion`, { headers: authHeaders() });
    if (res.status === 401) return null;
    if (!res.ok) return undefined;
    return (await res.json()).rol || null;
  } catch {
    return undefined;
  }
}

// ¿Tiene el servidor su propia clave de Gemini? true/false, o null si no se puede
// saber (sin sesión de admin, sin red o un servidor sin /api/ia).
export async function comprobarClaveIaEnServidor() {
  try {
    const res = await fetchConLimite(`${API_BASE}/ia/estado`, { headers: authHeaders() });
    if (!res.ok) return null;
    return !!(await res.json()).configurada;
  } catch {
    return null;
  }
}

/**
 * Verify the admin password against the backend (never compared client-side)
 * and store the resulting signed session token.
 */
export async function loginAdmin(password) {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Contraseña incorrecta' };
    }
    setStoredAdminToken(data.token, data.expiresAt);
    return { success: true, token: data.token };
  } catch (err) {
    return { success: false, error: 'No se pudo contactar con el servidor. Inténtalo de nuevo.' };
  }
}

/**
 * Change the admin password (requires a valid current session token)
 */
export async function changeAdminPassword(currentPassword, newPassword) {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'No se pudo cambiar la contraseña' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: 'No se pudo contactar con el servidor. Inténtalo de nuevo.' };
  }
}

// Cierra todas las sesiones de admin y deja sin efecto todos los enlaces de socias
// enviados (también los antiguos con la sesión de admin dentro) SIN cambiar la clave.
// Esta sesión sigue: el servidor devuelve una nueva. { ok, error }
export async function cerrarSesionesEnAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/cerrar-sesiones`, {
      method: 'POST',
      headers: { ...authHeaders() }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) return { ok: false, error: data.error || 'No se pudieron cerrar las sesiones' };
    setStoredAdminToken(data.token, data.expiresAt);
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo contactar con el servidor. Inténtalo de nuevo.' };
  }
}

// Ajustes del admin (GET/PUT /api/auth/ajustes): { exigirEnlaceAlFichar }, { sinSesion: true }
// si la sesión ya no vale (se cerraron las sesiones o cambió la clave), o null si no se pudo.
export async function fetchAjustesAdmin() {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/ajustes`, { headers: { ...authHeaders() } });
    if (res.status === 401) return { sinSesion: true };
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
export async function guardarAjustesAdmin(ajustes) {
  try {
    const res = await fetchConLimite(`${API_BASE}/auth/ajustes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(ajustes)
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function logoutAdmin() {
  cerrarAccesosGuardados();
}

/**
 * Fetch all clock entries from MongoDB / Backend API
 */
export async function fetchClockEntriesFromAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
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
export async function fetchClockEntryChangesFromAPI(desde) {
  try {
    const res = await fetchConLimite(`${API_BASE}/clock?desde=${encodeURIComponent(desde)}`);
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

  const stillPending = [];
  const synced = [];
  for (const entry of pending) {
    try {
      const res = await fetchConLimite(`${API_BASE}/clock`, {
        method: 'POST',
        headers: cabecerasDeFichaje(entry),
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        synced.push(entry);
      } else if (await rechazoDefinitivo(res)) {
        // No va a entrar nunca: fuera de la cola. Antes se reintentaba cada 20 s para
        // siempre y gastaba el límite por IP de todos los que fichan desde esa red.
        console.warn('Fichaje pendiente rechazado por el servidor, sale de la cola:', entry.id);
      } else {
        stillPending.push(entry);
      }
    } catch {
      stillPending.push(entry);
    }
  }
  setPendingClockEntries(stillPending);
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

/**
 * Helper to check whether a balances dataset has real numbers/breakdowns
 * and is not just an empty placeholder template of zeroes. Exportada para
 * que useBalances.js use exactamente el mismo criterio al leer su propia
 * caché en localStorage, en vez de una comprobación parecida pero no
 * idéntica hecha aparte.
 */
export function hasRealBalancesData(data) {
  if (!data || !Array.isArray(data.workers) || data.workers.length === 0) return false;
  return data.workers.some(w => 
    (Array.isArray(w.breakdown) && w.breakdown.length > 0) || 
    (typeof w.currentBalance === 'number' && w.currentBalance !== 0)
  );
}

/**
 * Fetch worker balances & agreements with resilient offline fallback
 */
export async function fetchBalancesFromAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/balances`, { headers: { ...authHeaders() } });
    // Sin acceso (sin sesión, enlace caducado o anulado): ni la copia local.
    if (res.status === 401) {
      localStorage.removeItem(BALANCES_CACHE_KEY);
      return initialBalancesData;
    }
    if (res.ok) {
      const data = await res.json();
      if (hasRealBalancesData(data)) {
        try {
          localStorage.setItem(BALANCES_CACHE_KEY, JSON.stringify(data));
        } catch { /* sin almacenamiento (modo privado): se sigue sin él */ }
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend API balances fetch failed, using fallback:', err.message);
  }

  // Fallback to localStorage only if it contains real populated data
  try {
    const saved = localStorage.getItem(BALANCES_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (hasRealBalancesData(parsed)) {
        return parsed;
      } else {
        localStorage.removeItem(BALANCES_CACHE_KEY);
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Guarantee that real initial balances data is always returned
  return initialBalancesData;
}

/**
 * Save worker balance update in MongoDB Atlas
 */
export async function saveWorkerBalanceToAPI(workerId, updatePayload) {
  try {
    const res = await fetchConLimite(`${API_BASE}/balances/${workerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(updatePayload)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API worker balance update failed:', err.message);
  }
  // null en vez de `updatePayload` echoado: quien llama (persistWorkerBalance
  // en PartnerDashboardView.jsx) ya actualiza el estado local de forma
  // optimista ANTES de llamar a esto — sin una señal clara de fallo, un
  // cambio de saldo que no llegara a Mongo se veía "guardado" en pantalla
  // y desaparecía solo en el siguiente refresco, sin explicación.
  return null;
}

/**
 * Fetch the shared weekly planning (schedule, weddings, etc.) from MongoDB —
 * so every device sees the same plan instead of each browser's own local copy.
 */
export async function fetchWeeksFromAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Backend API weeks fetch failed, using local fallback:', err.message);
  }
  return null;
}

/**
 * Save the full weeks map (all weeks) to MongoDB Atlas — reemplaza el
 * documento completo de cada semana, así que el servidor exige admin.
 */
export async function saveWeeksToAPI(weeksPayload) {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(weeksPayload)
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 409) {
      // Guardado concurrente: alguien más ha guardado esta semana desde que
      // se abrió para editar (control de concurrencia por `updatedAt` en
      // logistics.routes.js). Se distingue de un fallo cualquiera para que
      // quien llama pueda avisar del motivo real en vez de un genérico
      // "no se pudo guardar" — y sobre todo, para NO reintentar a ciegas
      // (eso perdería el cambio ajeno otra vez).
      const body = await res.json().catch(() => ({}));
      return { conflict: true, message: body.message, data: body.data };
    }
  } catch (err) {
    console.warn('Backend API weeks save failed:', err.message);
  }
  return null;
}

/**
 * Marca/desmarca UNA tarea del planning como completada — sin necesitar
 * sesión de admin (a diferencia de saveWeeksToAPI). Es lo que usa el propio
 * trabajador al fichar salida de una tarea o al tocarla en su cuadrante;
 * el servidor solo permite tocar los campos `completed` y `reopened` de esa
 * tarea, nunca el resto del documento de la semana.
 */
export async function patchTaskCompletionInAPI(weekId, dayKey, taskIndex, completed, reopened, completedAt) {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks/${weekId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // `reopened` (opcional): true si alguien la desmarcó a propósito.
      // `completedAt`: hora real de completado.
      body: JSON.stringify({ dayKey, taskIndex, completed, reopened, completedAt })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API task completion patch failed:', err.message);
  }
  return null;
}

/**
 * Apuntes del Calendario Gula entre dos fechas (YYYY-MM-DD), leídos por el
 * servidor (solo admin). Devuelve { configurado, apuntes, error? }.
 * `configurado: false` = el servidor no tiene las variables del calendario.
 */
export async function fetchCalendarioApuntes(desde, hasta) {
  try {
    const res = await fetchConLimite(`${API_BASE}/calendario/eventos?desde=${desde}&hasta=${hasta}`, { headers: { ...authHeaders() } });
    if (res.status === 503) return { configurado: false, apuntes: [] };
    if (!res.ok) {
      try {
        const errorData = await res.json();
        return { configurado: true, apuntes: [], error: errorData.error || `HTTP ${res.status}` };
      } catch (e) {
        return { configurado: true, apuntes: [], error: `HTTP ${res.status}` };
      }
    }
    return await res.json();
  } catch (err) {
    return { configurado: true, apuntes: [], error: err.message };
  }
}

/**
 * Crea una semana en BORRADOR (o, con `reemplazar`, sustituye un borrador que
 * ya exista). El servidor nunca pisa una semana que no sea borrador.
 * Devuelve { ok, status, existe? }.
 */
export async function createDraftWeekInAPI(weekId, week, reemplazar = false) {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ weekId, week, reemplazar })
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, existe: !!body.existe };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

export async function deleteWeekFromAPI(weekId) {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks/${encodeURIComponent(weekId)}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await res.json();
    } else {
      return { success: false, message: `El servidor respondió con un error no esperado (Status ${res.status}). Es posible que el backend aún se esté actualizando, inténtalo en un par de minutos.` };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Dirección completa de un archivo subido al servidor (`/uploads/…`). Relativa, el
// navegador la buscaba en la web de la app (GitHub Pages) y daba 404.
export const urlDeArchivoSubido = (ruta) => (ruta ? new URL(ruta, API_BASE).href : '');

// El PDF de un camión (Flota) como dirección local (blob) para abrirlo: el servidor lo
// guarda en la base y solo lo da con la sesión de admin. Los antiguos (/uploads/…)
// estaban en el disco de Render, que se borra solo: si ya no están, se dice.
export async function urlLocalDeDocumento(ruta) {
  const res = await fetchConLimite(urlDeArchivoSubido(ruta), { headers: { ...authHeaders() } });
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'El archivo ya no está en el servidor: vuelve a subirlo.'
      : res.status === 401 ? 'Hace falta la sesión de administrador.' : `Error del servidor (HTTP ${res.status}).`);
  }
  const url = URL.createObjectURL(await res.blob());
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  return url;
}

export async function uploadRentalPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetchConLimite(`${API_BASE}/logistics/upload-rental`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getStoredAdminToken()}`
    },
    body: formData
  }, 2 * 60 * 1000);
  
  if (!res.ok) {
    throw new Error('Error al subir el archivo');
  }
  return await res.json();
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

export async function fetchRosterFromAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/roster`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.workers || null;
  } catch (err) {
    console.error("Failed to fetch roster:", err);
    return null;
  }
}

export async function saveRosterToAPI(workers) {
  try {
    const token = getStoredAdminToken();
    const res = await fetchConLimite(`${API_BASE}/roster`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ workers })
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to save roster:", err);
    return false;
  }
}

// --- AI MEMORY API ---
// Gemini a través del servidor, con su clave (GEMINI_API_KEY en Render). `body` es
// el JSON ya preparado para Gemini. Devuelve la Response tal cual (mismo formato que
// la de Google), o una respuesta 0 si no hay red.
export async function llamarGeminiEnServidor(body) {
  try {
    return await fetchConLimite(`${API_BASE}/ia/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body
    }, 3 * 60 * 1000); // el servidor puede probar varios modelos, y cada uno piensa
  } catch {
    return { ok: false, status: 0, json: async () => ({}) };
  }
}

// Reglas del asistente (/api/aimemory, solo admin). Devuelven null si falla
// (getAiMemories, lista vacía) — el asistente sigue funcionando sin ellas.
async function peticionMemoria(ruta = '', { method = 'GET', body } = {}) {
  try {
    const res = await fetchConLimite(`${API_BASE}/aimemory${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`Error ${res.status} en ${method} /aimemory${ruta}`);
    return await res.json();
  } catch (error) {
    console.error('Memoria IA:', error.message);
    return null;
  }
}

export async function getAiMemories() {
  return (await peticionMemoria()) || [];
}

// `estado: 'propuesta'` para las que sugiere el asistente (no entran en el
// prompt hasta aprobarlas); sin él, activa.
export function addAiMemory(content, { estado, origen } = {}) {
  return peticionMemoria('', { method: 'POST', body: { content, estado, origen } });
}

export function aprobarAiMemory(id) {
  return peticionMemoria(`/${id}`, { method: 'PATCH', body: { estado: 'activa' } });
}

export function deleteAiMemory(id) {
  return peticionMemoria(`/${id}`, { method: 'DELETE' });
}
