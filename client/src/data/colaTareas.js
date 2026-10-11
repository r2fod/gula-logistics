// Marcar una tarea sin cobertura. Como los fichajes (cola en apiService.js): lo que
// no llega al servidor se guarda en el móvil, se reintenta y, mientras tanto, lo que
// trae el servidor no lo desmarca. Antes la marca se perdía: la salida de una tarea
// fichada sin red entraba después (cola de fichajes) pero la tarea se quedaba sin hacer.
import { API_BASE, fetchConLimite } from './servidor';
import { buildTaskListPatch, getTaskListForDay } from './taskPlanning';

const CLAVE = 'gula_pending_task_sync_v1';

function leer() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
function guardar(lista) {
  try {
    if (lista.length) localStorage.setItem(CLAVE, JSON.stringify(lista));
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento: no hay cola, como antes */ }
}
const mismaTarea = (a, b) => a.weekId === b.weekId && a.dayKey === b.dayKey && a.taskIndex === b.taskIndex;

export const tareasPendientes = () => leer();

// Un PATCH que no se pudo mandar (sin red, servidor caído o dormido). La última vez
// que se toca una tarea es la que vale.
function encolar(cambio) {
  guardar([...leer().filter(p => !mismaTarea(p, cambio)), cambio]);
}

async function enviar({ weekId, dayKey, taskIndex, completed, reopened, completedAt }) {
  return fetchConLimite(`${API_BASE}/logistics/weeks/${weekId}/tasks`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    // `reopened` (opcional): true si alguien la desmarcó a propósito.
    // `completedAt`: hora real de completado.
    body: JSON.stringify({ dayKey, taskIndex, completed, reopened, completedAt })
  });
}

// ¿Merece la pena reintentar? Sin red, 5xx (o el servidor despertando) y 429, sí; un
// 400/404 (la semana o la tarea ya no están), no.
const reintentable = (res) => !res || res.status >= 500 || res.status === 429;

/**
 * Marca/desmarca UNA tarea del planning como completada — sin necesitar
 * sesión de admin (a diferencia de saveWeeksToAPI). Es lo que usa el propio
 * trabajador al fichar salida de una tarea o al tocarla en su cuadrante;
 * el servidor solo permite tocar los campos `completed` y `reopened` de esa
 * tarea, nunca el resto del documento de la semana. Si no llega, queda en la cola.
 */
export async function patchTaskCompletionInAPI(weekId, dayKey, taskIndex, completed, reopened, completedAt) {
  const cambio = { weekId, dayKey, taskIndex, completed, reopened, completedAt };
  let res = null;
  try {
    res = await enviar(cambio);
    if (res.ok) {
      guardar(leer().filter(p => !mismaTarea(p, cambio)));
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API task completion patch failed:', err.message);
  }
  if (reintentable(res)) encolar(cambio);
  return null;
}

// Reintenta las pendientes (cada 20 s desde App.jsx y al volver la red). Devuelve las
// que ya se guardaron.
export async function retryPendingTaskPatches() {
  const pendientes = leer();
  if (!pendientes.length) return [];
  const guardadas = [];
  const siguen = [];
  for (const cambio of pendientes) {
    let res = null;
    try { res = await enviar(cambio); } catch { /* sin red */ }
    if (res?.ok) guardadas.push(cambio);
    else if (reintentable(res)) siguen.push(cambio);
  }
  // Sale de la cola lo intentado que ya se guardó (o no tiene arreglo); lo que se tocó
  // mientras se reintentaba se queda tal cual.
  const intentada = (p) => pendientes.some(q => mismaTarea(q, p) && q.completed === p.completed && q.completedAt === p.completedAt);
  guardar(leer().filter(p => !intentada(p) || siguen.some(q => mismaTarea(q, p))));
  return guardadas;
}

// Las semanas que llegan del servidor con las tareas pendientes de subir aplicadas
// encima (si no, el sondeo de 20 s las desmarcaba en pantalla).
export function conTareasPendientes(semanas) {
  const pendientes = leer();
  if (!semanas || !pendientes.length) return semanas;
  const resultado = { ...semanas };
  pendientes.forEach(({ weekId, dayKey, taskIndex, completed, reopened, completedAt }) => {
    const semana = resultado[weekId];
    const lista = [...getTaskListForDay(semana, dayKey)];
    const tarea = lista[taskIndex];
    if (!semana || tarea === undefined) return;
    lista[taskIndex] = { ...(typeof tarea === 'object' ? tarea : { text: tarea }), completed, reopened, completedAt };
    resultado[weekId] = { ...semana, ...buildTaskListPatch(semana, dayKey, lista) };
  });
  return resultado;
}
