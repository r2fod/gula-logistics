// Horarios de las tareas ("HH:MM - HH:MM") en un solo sitio: antes el planning, los
// avisos, la estimación de horas y el optimizador tenían cada uno su propio lector.

const HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// "09:30" → 570; null si no es una hora.
export const aMinutos = (hhmm) => {
  const m = HORA.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// "20:30 - 00:30" → { ini: 1230, fin: 1470 } (si cruza medianoche, fin pasa de 1440); null si no hay horario.
export function tramoDeHorario(horario) {
  const m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(horario || '');
  if (!m) return null;
  const ini = Number(m[1]) * 60 + Number(m[2]);
  let fin = Number(m[3]) * 60 + Number(m[4]);
  if (fin <= ini) fin += 1440;
  return { ini, fin };
}

// "9:00-11:30", "09.00 a 11.30" → "09:00 - 11:30". Lo que no se entiende se deja tal cual.
export function normalizarHorario(horario) {
  const texto = String(horario || '').trim();
  const m = /^(\d{1,2})[:.h](\d{2})\s*(?:-|–|—|a)\s*(\d{1,2})[:.h](\d{2})$/i.exec(texto);
  if (!m) return texto;
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(m[1])}:${m[2]} - ${dos(m[3])}:${m[4]}`;
}
