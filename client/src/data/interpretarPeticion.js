import { crearRestriccion, DIAS_SEMANA } from './disponibilidad';
import { plano } from '../utils/texto';

// Entiende SIN Gemini (0 tokens) lo que se pide a menudo sobre el equipo:
//   "Persona1 no puede el jueves", "Ana descansa el sábado",
//   "Luis solo puede de 9 a 14 el viernes", "Eva no puede el martes por la tarde",
//   "Pau hasta las 13 el lunes", "Ana y Luis no pueden el jueves ni el viernes".
// Devuelve las restricciones (disponibilidad.js) o null si no lo tiene claro: entonces
// se le pregunta a Gemini. Mejor no entender que entender mal.

const DIA_TEXTO = { martes: 'martes', miercoles: 'miercoles', jueves: 'jueves', viernes: 'viernes', sabado: 'sabado', domingo: 'domingo', lunes: 'lunes' };
const FRANJAS = { manana: ['06:00', '14:00'], tarde: ['14:00', '22:00'], noche: ['20:00', '02:00'] };
const hora = (h, m) => `${String(Number(h)).padStart(2, '0')}:${m || '00'}`;

// ¿Es una frase sobre cuándo puede o no alguien? (para no mandarla a Gemini)
export const PARECE_DISPONIBILIDAD = /\b(no puede[n]?|no esta[n]?|no viene[n]?|no trabaja[n]?|descansa[n]?|libra[n]?|de vacaciones|de baja|solo puede[n]?|solo (?:de|por|hasta|a partir)|unicamente|hasta las|a partir de las|desde las)\b/;

export function interpretarDisponibilidad(texto, equipo = []) {
  const t = ` ${plano(texto).replace(/[.,;!¡?¿]/g, ' ')} `;
  if (!PARECE_DISPONIBILIDAD.test(t)) return null;
  // Algo que cambia tareas ("y pon a Luis en su lugar") ya no es solo disponibilidad.
  if (/\b(pon|cambia|mueve|quita|anade|asigna|sustituye)\b/.test(t)) return null;

  const personas = equipo.map(w => w.name).filter(n => new RegExp(`\\b${plano(n.split(/\s+/)[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
  if (!personas.length) return null;

  const dias = /\btoda la semana\b|\besta semana\b/.test(t) ? ['semana'] : DIAS_SEMANA.filter(d => t.includes(` ${DIA_TEXTO[d]} `));
  if (!dias.length) return null;

  const ausente = /\b(no puede[n]?|no esta[n]?|no viene[n]?|no trabaja[n]?|de vacaciones|de baja)\b/.test(t);
  let tipo = /\bdescansa|\blibra/.test(t) ? 'descansa' : 'no';
  let desde = '';
  let hasta = '';
  const rango = /\b(?:de|entre las?)\s+(\d{1,2})(?:[:h.](\d{2}))?\s+(?:a|y)\s+(?:las?\s+)?(\d{1,2})(?:[:h.](\d{2}))?\b/.exec(t);
  const hastaLas = /\bhasta las?\s+(\d{1,2})(?:[:h.](\d{2}))?\b/.exec(t);
  const desdeLas = /\b(?:a partir de|desde) las?\s+(\d{1,2})(?:[:h.](\d{2}))?\b/.exec(t);
  const franja = /\bpor la (manana|tarde|noche)\b/.exec(t);
  // "Pau hasta las 13 el lunes" (sin "no") dice cuándo SÍ puede.
  const soloPuede = /\bsolo\b|\bunicamente\b/.test(t) || (!ausente && tipo !== 'descansa');

  if (rango) { tipo = 'solo'; [desde, hasta] = [hora(rango[1], rango[2]), hora(rango[3], rango[4])]; }
  else if (hastaLas && soloPuede) { tipo = 'solo'; [desde, hasta] = ['06:00', hora(hastaLas[1], hastaLas[2])]; }
  else if (desdeLas && soloPuede) { tipo = 'solo'; [desde, hasta] = [hora(desdeLas[1], desdeLas[2]), '23:59']; }
  else if (franja) {
    // "solo por la mañana" = puede por la mañana; "no puede por la tarde" = solo por la mañana.
    if (soloPuede) { tipo = 'solo'; [desde, hasta] = FRANJAS[franja[1]]; }
    else if (franja[1] === 'tarde' || franja[1] === 'noche') { tipo = 'solo'; [desde, hasta] = franja[1] === 'tarde' ? ['06:00', '14:00'] : ['06:00', '20:00']; }
    else { tipo = 'solo'; [desde, hasta] = ['14:00', '23:59']; }
  } else if (soloPuede && tipo === 'no') {
    return null; // "solo puede el jueves" (qué días sí) no se interpreta sin Gemini
  }

  const restricciones = [];
  for (const persona of personas) {
    for (const dia of dias) {
      const { restriccion, error } = crearRestriccion({ persona, dia, tipo, desde, hasta });
      if (error) return null;
      restricciones.push(restriccion);
    }
  }
  return restricciones;
}
