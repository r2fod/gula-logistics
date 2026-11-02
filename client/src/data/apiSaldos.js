// Saldos: la ficha de cada trabajador (su enlace) y todos los saldos del equipo.
import { initialBalancesData } from './balancesData';
import { API_BASE, fetchConLimite } from './servidor';
import { authHeaders, BALANCES_CACHE_KEY } from './accesos';

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
// `soloServidor`: lo que hay AHORA en el servidor o null, nunca la copia del navegador
// (para escribir encima: un apunte sobre una copia vieja borraría lo apuntado después).
export async function fetchBalancesFromAPI({ soloServidor = false } = {}) {
  try {
    const res = await fetchConLimite(`${API_BASE}/balances`, { headers: { ...authHeaders() } });
    // Sin acceso (sin sesión, enlace caducado o anulado): ni la copia local.
    if (res.status === 401) {
      localStorage.removeItem(BALANCES_CACHE_KEY);
      return soloServidor ? null : initialBalancesData;
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
  if (soloServidor) return null;

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
