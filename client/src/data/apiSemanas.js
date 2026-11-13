// Semanas del planning (leer, guardar, borradores, borrar) y apuntes del calendario.
import { API_BASE, fetchConLimite } from './servidor';
import { conTareasPendientes } from './colaTareas';
import { authHeaders } from './accesos';

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
      // Con las tareas marcadas sin red encima: si no, el sondeo las desmarcaba.
      return conTareasPendientes(data);
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
    return { ok: res.ok, status: res.status, existe: !!body.existe, name: body.data?.name };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function gestionarSemana(ruta, method, datos) {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks/${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(datos),
    });
    const resultado = await res.json().catch(() => null);
    if (res.ok && resultado?.success) return resultado;
    return { success: false, message: resultado?.message || 'No se pudo guardar el cambio de semana.' };
  } catch {
    return { success: false, message: 'No se pudo conectar para guardar el cambio de semana.' };
  }
}

export const crearSemanaManualEnAPI = (weekId, week) => gestionarSemana('manual', 'POST', { weekId, week });
export const renombrarSemanaEnAPI = (weekId, name, updatedAt) =>
  gestionarSemana(encodeURIComponent(weekId), 'PATCH', { name, updatedAt });
export const deleteWeekFromAPI = (weekId, updatedAt) =>
  gestionarSemana(encodeURIComponent(weekId), 'DELETE', { updatedAt });

export async function leerSemanasArchivadas() {
  try {
    const res = await fetchConLimite(`${API_BASE}/logistics/weeks/archivadas`, { headers: authHeaders() });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
