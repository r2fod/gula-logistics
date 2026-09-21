// Enlaces que la app genera y comparte (por WhatsApp o copiándolos). Un solo
// sitio para no repetir cómo se construyen.

// Dirección de la app sin parámetros (funciona igual en local y en GitHub Pages).
export const urlBase = () => `${window.location.origin}${window.location.pathname}`;

// Vista de un trabajador en una semana concreta.
export const enlaceTrabajador = (weekId, nombre) =>
  `${urlBase()}?week=${weekId}&worker=${encodeURIComponent(nombre)}`;

// Panel de socias. Con `token` (sesión de admin) el enlace ya entra sin clave.
export const enlaceSocias = (token) => `${urlBase()}?socias${token ? `&token=${token}` : ''}`;

// Vista pública (sin saldos ni nóminas).
export const enlaceVistaPublica = () => `${urlBase()}?view=public`;

// Abre WhatsApp con el texto ya escrito.
export const enlaceWhatsApp = (texto) => `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
