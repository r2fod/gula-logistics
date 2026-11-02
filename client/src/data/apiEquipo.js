// Equipo y tarifas por defecto (/api/roster).
import { API_BASE, fetchConLimite } from './servidor';
import { getStoredAdminToken } from './accesos';

// El equipo y las tarifas por defecto (ver tarifasPorDefecto.js): { workers, tarifas }, o
// null si no se pudo leer.
export async function fetchRosterFromAPI() {
  try {
    const res = await fetchConLimite(`${API_BASE}/roster`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.workers ? { workers: data.workers, tarifas: data.tarifas || {} } : null;
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

// Las tarifas por defecto ({ extra, nomina, transporte }): solo el admin. Devuelve las que
// quedaron guardadas, o null si no se pudo (sesión, red o valores no válidos).
export async function saveTarifasToAPI(tarifas) {
  try {
    const token = getStoredAdminToken();
    const res = await fetchConLimite(`${API_BASE}/roster`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ tarifas })
    });
    if (!res.ok) return null;
    return (await res.json()).tarifas || {};
  } catch (err) {
    console.error("Failed to save tarifas:", err);
    return null;
  }
}
