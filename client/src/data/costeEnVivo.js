import { repartirBolsa, tieneBolsa } from './bolsaHoras';
import { isZombieShift } from './shiftCalculations';
import { coincideNombre } from './nombresTrabajadores';

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

// Lo que llevan AHORA los turnos abiertos que empezaron en el periodo [desde, hasta)
// (sin límites = todo el histórico), para que el Resumen Financiero suba en directo
// como Saldos. Tarifa y nómina como al emparejar turnos (pairShiftsFromEntries y
// aggregateShiftsByWorker); `turnos` son los ya cerrados, para la bolsa. Un turno
// abierto más de 16 h es un olvido de fichar la salida: se revisa, no se suma.
// { turnos, horas, extras, nomina }
export function enCursoDelPeriodo(abiertos = [], { desde = null, hasta = null } = {}, { ahora = new Date(), equipo = [], fichas = [], turnos = [] } = {}) {
  const suma = { turnos: 0, horas: 0, extras: 0, nomina: 0 };
  (abiertos || []).forEach(entrada => {
    const inicio = new Date(entrada?.timestamp).getTime();
    if (Number.isNaN(inicio) || (desde && inicio < desde.getTime()) || (hasta && inicio >= hasta.getTime()) || isZombieShift(entrada, ahora)) return;
    const esSuyo = (nombre) => coincideNombre(nombre, entrada.workerName);
    const persona = equipo.find(w => esSuyo(w.name));
    const { horas, coste } = costeEnCurso({
      entrada,
      ahora,
      tarifa: entrada.rate || (entrada.isPayroll ? 14 : 10),
      ficha: (fichas || []).find(f => esSuyo(f.name)) || null,
      horasPrevias: turnos.filter(t => esSuyo(t.workerName)).reduce((s, t) => s + (t.durationHours || 0), 0),
    });
    suma.turnos += 1;
    suma.horas += horas;
    if (persona ? persona.isPayroll : entrada.isPayroll) suma.nomina += coste;
    else suma.extras += coste;
  });
  return suma;
}

// "2h 05m 09s" desde la entrada hasta `ahora`.
export function duracionEnCurso(entrada, ahora = new Date()) {
  const ms = Math.max(0, ahora.getTime() - new Date(entrada?.timestamp).getTime()) || 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
