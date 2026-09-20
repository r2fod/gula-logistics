// Central API Client for Gula Logistics Backend & MongoDB Atlas
import { initialBalancesData } from './balancesData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_STORAGE_KEY = 'gula_admin_token_v1';

/**
 * Admin session token helpers (backed by the server, not a hardcoded password)
 */
export function getStoredAdminToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() > expiresAt) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token, expiresAt) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
}

export function clearStoredAdminToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function authHeaders() {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Verify the admin password against the backend (never compared client-side)
 * and store the resulting signed session token.
 */
export async function loginAdmin(password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
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
    const res = await fetch(`${API_BASE}/auth/change-password`, {
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

export function logoutAdmin() {
  clearStoredAdminToken();
}

/**
 * Fetch all clock entries from MongoDB / Backend API
 */
export async function fetchClockEntriesFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/clock`);
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
 * guardado si funciona, o `null` si no (el fichaje queda en la cola de
 * pendientes para reintentarlo más tarde, no se pierde).
 */
export async function saveClockEntryToAPI(entry) {
  try {
    const res = await fetch(`${API_BASE}/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
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
      const res = await fetch(`${API_BASE}/clock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        synced.push(entry);
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
    const res = await fetch(`${API_BASE}/clock/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API update failed, updating locally:', err.message);
  }
  return entry;
}

/**
 * Delete clock entry in MongoDB / Backend API
 */
export async function deleteClockEntryInAPI(entryId) {
  try {
    await fetch(`${API_BASE}/clock/${entryId}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
  } catch (err) {
    console.warn('Backend API delete failed:', err.message);
  }
}

/**
 * Restore clock entry in MongoDB / Backend API
 */
export async function restoreClockEntryInAPI(entryId) {
  try {
    await fetch(`${API_BASE}/clock/${entryId}/restore`, {
      method: 'PUT',
      headers: { ...authHeaders() }
    });
  } catch (err) {
    console.warn('Backend API restore failed:', err.message);
  }
}

/**
 * Clear all clock entries in MongoDB / Backend API
 */
export async function clearAllClockEntriesInAPI() {
  try {
    await fetch(`${API_BASE}/clock`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
  } catch (err) {
    console.warn('Backend API clear failed:', err.message);
  }
}

/**
 * Helper to check whether a balances dataset has real numbers/breakdowns
 * and is not just an empty placeholder template of zeroes.
 */
function hasRealBalancesData(data) {
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
    const res = await fetch(`${API_BASE}/balances`, { headers: { ...authHeaders() } });
    if (res.ok) {
      const data = await res.json();
      if (hasRealBalancesData(data)) {
        try {
          localStorage.setItem('gula_balances_data_v1', JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend API balances fetch failed, using fallback:', err.message);
  }

  // Fallback to localStorage only if it contains real populated data
  try {
    const saved = localStorage.getItem('gula_balances_data_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (hasRealBalancesData(parsed)) {
        return parsed;
      } else {
        localStorage.removeItem('gula_balances_data_v1');
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
    const res = await fetch(`${API_BASE}/balances/${workerId}`, {
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
  return updatePayload;
}

/**
 * Fetch the shared weekly planning (schedule, weddings, etc.) from MongoDB —
 * so every device sees the same plan instead of each browser's own local copy.
 */
export async function fetchWeeksFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/logistics/weeks`);
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
    const res = await fetch(`${API_BASE}/logistics/weeks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(weeksPayload)
    });
    if (res.ok) {
      return await res.json();
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
 * el servidor solo permite tocar el campo `completed` de esa tarea, nunca
 * el resto del documento de la semana.
 */
export async function patchTaskCompletionInAPI(weekId, dayKey, taskIndex, completed) {
  try {
    const res = await fetch(`${API_BASE}/logistics/weeks/${weekId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey, taskIndex, completed })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API task completion patch failed:', err.message);
  }
  return null;
}

export async function uploadRentalPdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/logistics/upload-rental`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getStoredAdminToken()}`
    },
    body: formData
  });
  
  if (!res.ok) {
    throw new Error('Error al subir el archivo');
  }
  return await res.json();
}

export async function optimizeDatabase() {
  const res = await fetch(`${API_BASE}/logistics/optimize`, {
    method: 'POST',
    headers: {
      ...authHeaders()
    }
  });
  
  if (!res.ok) {
    throw new Error('Error al optimizar la base de datos');
  }
  return await res.json();
}
