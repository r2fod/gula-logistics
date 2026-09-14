// Central API Client for Gula Logistics Backend & MongoDB Atlas
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
      // Sync local storage cache
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(data));
      return data;
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
export async function saveClockEntryToAPI(entry) {
  try {
    const res = await fetch(`${API_BASE}/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API disconnected, saving clock entry to localStorage fallback:', err.message);
  }
  return entry;
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
 * Fetch sensitive worker balances & agreements from MongoDB Atlas
 */
export async function fetchBalancesFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/balances`, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data && data.workers) {
      localStorage.setItem('gula_balances_data_v1', JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Backend API balances fetch failed, using local storage fallback:', err.message);
  }

  try {
    const saved = localStorage.getItem('gula_balances_data_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return null;
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
