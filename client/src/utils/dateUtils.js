/**
 * Formatos de fecha y hora de toda la app, siempre en español de España y con
 * reloj de 24 h (sin esto, el formato dependía del idioma del navegador de quien
 * fichaba). No hay que llamar a `toLocale*` suelto en ningún otro sitio.
 */

// Format: 15/9/2026 (sin cero a la izquierda, como se guarda en los fichajes)
export const formatDate = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleDateString('es-ES');
};

// Format: 10:30:00 (24h)
export const formatTime = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false 
  });
};

// Format: 10:30 (24h) - no seconds
export const formatTimeShort = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

export const parseDateString = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString);
};

// Sin el punto que el español pone tras las abreviaturas: "sept." -> "sept".
const sinPunto = (texto) => texto.replace('.', '');

// Format: lunes, 21 de septiembre de 2026
export const formatDateLong = (dateObj) =>
  new Date(dateObj).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Format: lunes 21
export const formatWeekdayDay = (dateObj) =>
  new Date(dateObj).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });

// Format: 21 sept
export const formatDayMonthShort = (dateObj) =>
  sinPunto(new Date(dateObj).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));

// Format: septiembre de 2026
export const formatMonthYear = (dateObj) =>
  new Date(dateObj).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

// Format: lun
export const formatWeekdayShort = (dateObj) =>
  sinPunto(new Date(dateObj).toLocaleDateString('es-ES', { weekday: 'short' }));

// Format: sept
export const formatMonthShort = (dateObj) =>
  sinPunto(new Date(dateObj).toLocaleDateString('es-ES', { month: 'short' }));
