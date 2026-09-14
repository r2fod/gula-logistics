// Central API Client for Gula Logistics Backend & MongoDB Atlas
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
      headers: { 'Content-Type': 'application/json' },
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
      method: 'DELETE'
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
      method: 'DELETE'
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
    const res = await fetch(`${API_BASE}/balances`);
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
      headers: { 'Content-Type': 'application/json' },
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
