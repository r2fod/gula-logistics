// Asistente (Gemini a través del servidor) y sus reglas guardadas (/api/aimemory).
import { API_BASE, fetchConLimite } from './servidor';
import { authHeaders } from './accesos';

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
