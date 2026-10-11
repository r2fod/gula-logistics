// Los festivos locales que guarda el admin en sus ajustes (servidor): cargarlos al
// entrar y guardarlos desde Configuración. Lo que se lee va a `festivos.js`, que es
// de donde lo cogen el generador, el Cuadrante y la flota.
import { fetchAjustesAdmin, guardarAjustesAdmin } from './apiService';
import { festivosLocales, limpiarFestivosLocales, usarFestivosLocales } from './festivos';

let carga = null;

// Una sola petición por sesión (o `forzar` tras iniciar sesión). Sin sesión de admin o
// sin red se queda con lo que hubiera: los festivos de regla siguen valiendo.
export function cargarFestivosLocales({ forzar = false } = {}) {
  if (!carga || forzar) {
    carga = Promise.resolve(fetchAjustesAdmin())
      .then((ajustes) => { if (Array.isArray(ajustes?.festivos)) usarFestivosLocales(ajustes.festivos); })
      .catch(() => { /* sin red: se queda con los de regla */ })
      .then(() => festivosLocales());
  }
  return carga;
}

// true si el servidor los guardó (y ya son los que usa la app).
export async function guardarFestivosLocales(lista) {
  const respuesta = await guardarAjustesAdmin({ festivos: limpiarFestivosLocales(lista) });
  if (!Array.isArray(respuesta?.festivos)) return false;
  usarFestivosLocales(respuesta.festivos);
  return true;
}
