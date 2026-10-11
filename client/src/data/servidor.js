// Conexión con el servidor: su dirección y el tiempo máximo de cada petición.
import { seguirPeticion } from './servidorLento';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Toda petición al servidor tiene un tiempo máximo. Sin él, una que se quedaba
// colgada (p. ej. en una conexión que el servidor ya había cerrado: el navegador no
// repite un POST por su cuenta) dejaba la pantalla "Generando enlace…" o "Guardando"
// para siempre. Pasado el tiempo, falla como si no hubiera red (y cada llamada hace
// lo que ya hacía sin red: un fichaje, por ejemplo, queda en la cola de pendientes).
// 60 s por defecto: más de lo que tarda en despertar el servidor dormido de Render.
export const ESPERA_MAXIMA_MS = 60 * 1000;
// Las de tiempo normal cuentan para el aviso «Despertando el servidor» (servidorLento.js);
// las largas a propósito (Gemini, subir un PDF), no.
export function fetchConLimite(url, opciones = {}, ms = ESPERA_MAXIMA_MS) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ms);
  const peticion = fetch(url, { ...opciones, signal: control.signal }).finally(() => clearTimeout(reloj));
  return ms === ESPERA_MAXIMA_MS ? seguirPeticion(peticion) : peticion;
}
