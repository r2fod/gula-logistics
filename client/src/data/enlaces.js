import { esBorrador } from './anticipacion';

// Enlaces de los trabajadores. El enlace de cada persona es SIEMPRE el mismo
// (`?worker=Nombre`, sin semana): al abrirlo enseña la semana que contiene hoy
// (semanaPorDefecto), así que se actualiza solo cada semana y no hay que volver a
// enviárselo. Antes llevaba `?week=<semana>` y cada semana había que mandar uno nuevo.
// Con `token` (el firmado que da el servidor al admin, ver crearEnlacesTrabajadoresEnAPI)
// la persona ve además SU saldo; sin él, solo su planning y sus horas.
export function construirEnlaceTrabajador(origen, ruta, nombre, token = null) {
  return `${origen}${ruta}?worker=${encodeURIComponent(nombre)}${token ? `&t=${encodeURIComponent(token)}` : ''}`;
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
export const enlaceTrabajador = (nombre, token = null) => construirEnlaceTrabajador(window.location.origin, window.location.pathname, nombre, token);

// Panel de socias. `tokenSocias` es el token de SOLO LECTURA que genera el servidor
// (crearTokenSociasEnAPI), nunca la sesión de admin; sin él el enlace no da acceso.
export const enlaceSocias = (tokenSocias) => `${urlBase()}?socias${tokenSocias ? `&acceso=${encodeURIComponent(tokenSocias)}` : ''}`;

// Vista pública (sin saldos ni nóminas).
export const enlaceVistaPublica = () => `${urlBase()}?view=public`;

// Teléfono listo para wa.me: solo cifras y con prefijo de país (uno español de 9
// cifras sin prefijo se entiende como +34). null si no parece un teléfono.
export function telefonoWhatsApp(telefono) {
  let cifras = String(telefono || '').replace(/\D/g, '');
  if (cifras.startsWith('00')) cifras = cifras.slice(2);
  if (/^[6789]\d{8}$/.test(cifras)) cifras = `34${cifras}`;
  return cifras.length >= 10 && cifras.length <= 15 ? cifras : null;
}

// Abre WhatsApp con el texto ya escrito: en el chat de ese `telefono` si lo hay (y es
// válido) o, sin él, eligiendo el contacto en WhatsApp.
export const enlaceWhatsApp = (texto, telefono = null) => {
  const numero = telefonoWhatsApp(telefono);
  return numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
};

// Abre un enlace en otra pestaña sin darle acceso a la de la app (`window.opener`):
// la página abierta no puede redirigir la app a otra dirección. Es lo que hace
// rel="noopener" en un <a>. No se usa la opción 'noopener' de window.open porque
// algún navegador antiguo abre entonces una ventana suelta en vez de una pestaña.
export function abrirEnPestanaNueva(url) {
  const ventana = window.open(url, '_blank');
  if (ventana) ventana.opener = null;
}

// Lo mismo para algo que hay que pedir antes (un PDF que el servidor solo da con la
// sesión de admin): la pestaña se abre YA, en el clic —abierta tras la espera, el
// navegador la bloquea como emergente— y recibe la dirección cuando llega. Si falla,
// se cierra y el error sigue hacia quien llama. `obtenerUrl`: async () => url.
export async function abrirEnPestanaNuevaAlLlegar(obtenerUrl) {
  const ventana = window.open('', '_blank');
  if (ventana) ventana.opener = null;
  try {
    const url = await obtenerUrl();
    if (ventana) ventana.location.href = url;
    else abrirEnPestanaNueva(url);
  } catch (error) {
    ventana?.close();
    throw error;
  }
}
