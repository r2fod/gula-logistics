import mongoose from 'mongoose';
import { ClockEntry } from '../models/ClockEntry.model.js';
import { plano } from '../utils/texto.js';

// Render (plan gratuito) duerme el servidor a los 15 min sin peticiones de fuera y tarda
// cerca de un minuto en despertar. Mientras está en marcha, el propio servidor se llama
// por su dirección pública cada 10 min: la petición sale a internet y vuelve a entrar
// por Render como cualquier otra. No hace falta ningún servicio externo (el keep-alive
// de GitHub se ejecuta cada 3–5 h y un aviso externo no sirvió). No es seguro que
// Render lo cuente como actividad: se comprueba con `activoDesde` de /api/health (si
// tras una noche sin uso sigue siendo de ayer, no se ha dormido).
//
// De 5 a 7 de la mañana (hora de Madrid) descansa: deja de llamarse y Render lo duerme
// si nadie usa la app, salvo que haya alguien con el turno abierto (un turno de noche
// tiene que poder fichar la salida sin esperar). Dormido ya no puede despertarse solo:
// lo hace el keep-alive de GitHub de después de las 7 o la primera persona que entre.
//
// Solo en Render (RENDER_EXTERNAL_URL lo pone él). Variables: MANTENER_DESPIERTO=no lo
// apaga; DESCANSO_SERVIDOR="5-7" cambia el tramo (horas de Madrid; "no" = sin descanso).
// Sin descanso gasta ~744 de las 750 h gratuitas de la cuenta al mes; con él, ~680.
const CADA_MS = 10 * 60 * 1000;
const HORAS_TURNO_VIVO = 16; // una entrada más antigua es un olvido de fichar la salida

const horaEnMadrid = (fecha) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(fecha));

// ¿Cae `fecha` en el tramo de descanso ("5-7": desde las 05:00 hasta antes de las 07:00,
// hora de Madrid; puede cruzar la medianoche, "23-6")? Un tramo ilegible = sin descanso.
export function enDescanso(fecha = new Date(), tramo = process.env.DESCANSO_SERVIDOR ?? '5-7') {
  const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(String(tramo).trim());
  if (!m) return false;
  const [desde, hasta] = [Number(m[1]) % 24, Number(m[2]) % 24];
  if (desde === hasta) return false;
  const hora = horaEnMadrid(fecha);
  return desde < hasta ? hora >= desde && hora < hasta : hora >= desde || hora < hasta;
}

// ¿Hay alguien con el turno abierto? Su último fichaje de jornada de las últimas 16 h es
// una entrada. Sin base no se sabe: se dice que no.
export async function hayTurnoAbierto(ahora = new Date()) {
  if (mongoose.connection.readyState !== 1) return false;
  const desde = new Date(ahora.getTime() - HORAS_TURNO_VIVO * 3600 * 1000).toISOString();
  const fichajes = await ClockEntry.find({ deleted: { $ne: true }, type: { $in: ['entrada', 'salida'] }, timestamp: { $gte: desde } })
    .select('workerName type timestamp').sort({ timestamp: -1 }).lean();
  const vistos = new Set();
  return fichajes.some((f) => {
    const persona = plano(f.workerName);
    if (vistos.has(persona)) return false;
    vistos.add(persona);
    return f.type === 'entrada';
  });
}

export function mantenerDespierto({ url = process.env.RENDER_EXTERNAL_URL, cadaMs = CADA_MS, pedir = fetch, hayActividad = hayTurnoAbierto } = {}) {
  if (!url || process.env.MANTENER_DESPIERTO === 'no') return null;
  const llamar = async () => {
    try {
      const ahora = new Date();
      if (enDescanso(ahora) && !(await hayActividad(ahora))) return;
      await pedir(`${url.replace(/\/+$/, '')}/api/health`, { signal: AbortSignal.timeout(20000) });
    } catch { /* un fallo suelto no importa: se repite en 10 min */ }
  };
  const reloj = setInterval(llamar, cadaMs);
  reloj.unref?.();
  return reloj;
}
