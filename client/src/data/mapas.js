// Enlace de Google Maps de un lugar; '' sin lugar o en la base. Una sola versión: antes
// lo construían el editor de tareas y el generador de borradores por su cuenta, y
// Gemini lo escribía a mano (a veces mal y gastando respuesta).
export const LUGAR_BASE = 'Almacén Base';

const esBase = (lugar) => /^almac[eé]n( base)?$/i.test(lugar);

export function enlaceMaps(lugar) {
  const sitio = String(lugar || '').trim();
  if (!sitio || esBase(sitio)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sitio).replace(/%20/g, '+')}`;
}
