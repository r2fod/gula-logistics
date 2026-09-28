import { esBorrador } from './anticipacion';

// Enlaces de los trabajadores. El enlace de cada persona es SIEMPRE el mismo
// (`?worker=Nombre`, sin semana): al abrirlo enseña la semana que contiene hoy
// (semanaPorDefecto), así que se actualiza solo cada semana y no hay que volver a
// enviárselo. Antes llevaba `?week=<semana>` y cada semana había que mandar uno nuevo.
export function construirEnlaceTrabajador(origen, ruta, nombre) {
  return `${origen}${ruta}?worker=${encodeURIComponent(nombre)}`;
}

// ¿El enlace pide una semana concreta (?week=) y hay que abrirla? Su id; si no, null
// y la app sigue sola "la de hoy" (semanaPorDefecto, en useWeeks).
//  · Un TRABAJADOR (enlace con ?worker= y sin sesión de admin) siempre ve la semana
//    actual, aunque el enlace sea uno viejo con ?week= (los que ya se enviaron con
//    la semana escrita dejan de quedarse anclados a ella).
//  · Un admin, o quien entra sin ?worker=, respeta ?week= si existe, salvo que sea
//    un borrador y no haya admin: un borrador solo lo abre un admin.
export function semanaPedidaEnEnlace({ weekParam = null, workerParam = null, hayAdmin = false, semanas = {} } = {}) {
  const esEnlaceDeTrabajador = Boolean(workerParam) && !hayAdmin;
  const semana = weekParam && !esEnlaceDeTrabajador ? semanas?.[weekParam] : null;
  return semana && !(esBorrador(semana) && !hayAdmin) ? weekParam : null;
}

// --- Otros enlaces de la app (un solo sitio para no repetir cómo se construyen) ---

// Dirección de la app sin parámetros (funciona igual en local y en GitHub Pages).
export const urlBase = () => `${window.location.origin}${window.location.pathname}`;

// Enlace fijo de un trabajador (ver `construirEnlaceTrabajador`) con la dirección actual.
export const enlaceTrabajador = (nombre) => construirEnlaceTrabajador(window.location.origin, window.location.pathname, nombre);

// Panel de socias. `tokenSocias` es el token de SOLO LECTURA que genera el servidor
// (crearTokenSociasEnAPI), nunca la sesión de admin; sin él el enlace no da acceso.
export const enlaceSocias = (tokenSocias) => `${urlBase()}?socias${tokenSocias ? `&acceso=${encodeURIComponent(tokenSocias)}` : ''}`;

// Vista pública (sin saldos ni nóminas).
export const enlaceVistaPublica = () => `${urlBase()}?view=public`;

// Abre WhatsApp con el texto ya escrito.
export const enlaceWhatsApp = (texto) => `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
