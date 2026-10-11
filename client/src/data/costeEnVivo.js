import { bolsaDeFicha, mesDe, repartirBolsa, tieneBolsa } from './bolsaHoras';
import { isZombieShift } from './shiftCalculations';
import { fichaDePersona, mismoNombre } from './nombresTrabajadores';

// Horas y dinero de un turno ABIERTO hasta `ahora`, para verlo subir en tiempo
// real. Sin redondear: al fichar la salida el turno se paga a la media hora más
// cercana (pairShiftsFromEntries), así que es "lo que lleva", no lo que se pagará.
// Sin tope, como al cerrar. Quien tiene bolsa de horas cobra como en Saldos:
// `turnosPrevios` son sus turnos ya cerrados (gastan bolsa antes que este; con un
// acuerdo por meses, solo los del mismo mes).
export function costeEnCurso({ entrada, ahora = new Date(), tarifa = 10, ficha = null, turnosPrevios = [] } = {}) {
  const inicio = new Date(entrada?.timestamp).getTime();
  if (Number.isNaN(inicio)) return { horas: 0, coste: 0 };
  const horas = Math.max(0, (ahora.getTime() - inicio) / 3600000);
  if (tieneBolsa(ficha)) {
    const previos = turnosPrevios || [];
    const reparto = repartirBolsa(
      [...previos.map(t => t.durationHours || 0), horas],
      bolsaDeFicha(ficha),
      [...previos.map(t => mesDe(t.startEntry?.timestamp)), mesDe(inicio)]
    );
    return { horas, coste: reparto[reparto.length - 1].coste };
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
    // La misma persona (no "lo contiene": los turnos de "Ana" contaban en la bolsa de "Mariana").
    const esSuyo = (nombre) => mismoNombre(nombre, entrada.workerName);
    const persona = equipo.find(w => esSuyo(w.name));
    const { horas, coste } = costeEnCurso({
      entrada,
      ahora,
      tarifa: entrada.rate || (entrada.isPayroll ? 14 : 10),
      ficha: fichaDePersona(entrada.workerName, fichas || [], equipo.map(w => w.name)),
      turnosPrevios: turnos.filter(t => esSuyo(t.workerName)),
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
