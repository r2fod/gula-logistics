// Central API Client for Gula Logistics Backend & MongoDB Atlas
// Barril: reexporta todo lo de cada tema para que nadie cambie sus imports. Aquí
// solo quedan los archivos subidos al servidor.
import { API_BASE, fetchConLimite } from './servidor';
import { authHeaders, getStoredAdminToken } from './accesos';

export * from './accesos';
export * from './apiFichajes';
export * from './apiSaldos';
export * from './apiSemanas';
export * from './apiEquipo';
export * from './apiIa';

// La cola de tareas marcadas sin red vive en colaTareas.js; se sigue pudiendo importar
// desde aquí.
export { patchTaskCompletionInAPI, retryPendingTaskPatches } from './colaTareas';

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
