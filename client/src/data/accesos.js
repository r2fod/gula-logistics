// Accesos: tokens de admin, socias y trabajador guardados en el navegador, login,
// sesión, ajustes del admin y las cabeceras de autorización de cada petición.
import { API_BASE, fetchConLimite } from './servidor';

const TOKEN_STORAGE_KEY = 'gula_admin_token_v1';
// Enlace de socias: token firmado de SOLO LECTURA (saldos y panel), aparte de
// la sesión de admin. Lo genera el admin (crearTokenSociasEnAPI) y llega en la URL.
const SOCIAS_TOKEN_STORAGE_KEY = 'gula_socias_token_v1';
// Enlace firmado de un trabajador (?worker=Nombre&t=…): solo le deja ver SU saldo.
// Se guarda con su nombre para no enseñárselo a otra persona que use el mismo móvil.
const TRABAJADOR_TOKEN_STORAGE_KEY = 'gula_trabajador_token_v1';
// Copia local de los saldos (la lee y escribe apiSaldos.js; aquí se borra al cerrar).
export const BALANCES_CACHE_KEY = 'gula_balances_data_v1';

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

// Copia del saldo de cada trabajador en su móvil (useMiSaldo): `<prefijo><nombre>`.
export const MI_SALDO_CACHE_PREFIJO = 'gula_mi_saldo_v1_';

// Cierra cualquier acceso de este navegador (admin y socias) y borra las copias
// locales de los saldos, para que no queden en un dispositivo compartido.
export function cerrarAccesosGuardados() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(SOCIAS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(BALANCES_CACHE_KEY);
  // Todas las de cada trabajador (antes se borraba una clave que ya no se usaba).
  const copias = [];
  for (let i = 0; i < localStorage.length; i++) {
    const clave = localStorage.key(i);
    if (clave?.startsWith(MI_SALDO_CACHE_PREFIJO.slice(0, -1))) copias.push(clave);
  }
  copias.forEach(k => localStorage.removeItem(k));
}

// La sesión de admin manda; si no la hay, el enlace de socias (solo sirve para
// lecturas: el servidor rechaza con él todo lo que escribe).
export function authHeaders() {
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

// Al abrir la app: ¿sigue valiendo el acceso guardado en este navegador? Una sesión de
// admin anulada («Cerrar todas las sesiones», clave cambiada) seguía pintando el panel
// de admin, con los saldos vacíos y sin poder guardar nada. Si ya no vale, se borra de
// aquí. 'vale' (o no se pudo comprobar: no se cierra nada) | 'socias' (la sesión de
// admin no vale, pero el enlace de socias de este navegador sí: queda en solo lectura)
// | 'admin-anulada' | 'socias-anulado'.
export async function revisarAccesoGuardado() {
  const eraAdmin = !!getStoredAdminToken();
  if (!eraAdmin && !getStoredSociasToken()) return 'vale';
  if ((await comprobarSesionEnAPI()) !== null) return 'vale';
  if (eraAdmin) {
    clearStoredAdminToken();
    if (getStoredSociasToken() && (await comprobarSesionEnAPI()) !== null) return 'socias';
  }
  logoutAdmin();
  return eraAdmin ? 'admin-anulada' : 'socias-anulado';
}
