import { repartirBolsa, tieneBolsa } from './bolsaHoras';

// Horas y dinero de un turno ABIERTO hasta `ahora`, para verlo subir en tiempo
// real. Sin redondear: al fichar la salida el turno se paga a la media hora más
// cercana (pairShiftsFromEntries), así que es "lo que lleva", no lo que se pagará.
// Tope de 14 h, como al cerrar. Quien tiene bolsa de horas cobra como en Saldos:
// `horasPrevias` son sus horas ya fichadas (gastan bolsa antes que este turno).
export function costeEnCurso({ entrada, ahora = new Date(), tarifa = 10, ficha = null, horasPrevias = 0 } = {}) {
  const inicio = new Date(entrada?.timestamp).getTime();
  if (Number.isNaN(inicio)) return { horas: 0, coste: 0 };
  const horas = Math.min(14, Math.max(0, (ahora.getTime() - inicio) / 3600000));
  if (tieneBolsa(ficha)) {
    const [r] = repartirBolsa([horas], { ...ficha.purseInfo, consumedHours: (ficha.purseInfo.consumedHours || 0) + horasPrevias });
    return { horas, coste: r.coste };
  }
  return { horas, coste: horas * (Number(tarifa) || 0) };
}

// "2h 05m 09s" desde la entrada hasta `ahora`.
export function duracionEnCurso(entrada, ahora = new Date()) {
  const ms = Math.max(0, ahora.getTime() - new Date(entrada?.timestamp).getTime()) || 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
