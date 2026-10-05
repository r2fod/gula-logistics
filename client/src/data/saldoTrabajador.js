import { bolsaDeFicha, mesDe, repartirBolsa, tieneBolsa } from './bolsaHoras';
import { costeEnCurso } from './costeEnVivo';
import { isZombieShift } from './shiftCalculations';

// Saldo de una persona: la MISMA cuenta en Saldos & Acuerdos y en la vista del propio
// trabajador.
//   lo apuntado a mano (ficha.currentBalance: turnos a mano, transporte, bolsa y
//   ajustes, con los pagos o adelantos restando)
// + sus turnos fichados y cerrados (con la regla de la bolsa si la tiene)
// + el turno abierto ahora mismo, en directo (sin redondear: al fichar la salida se
//   paga a la media hora). Un turno abierto más de 16 h es un olvido: no se suma.
//
// `horas`: su entrada de aggregateShiftsByWorker ({ totalHours, shifts }).
// Devuelve { costes (uno por turno fichado: { coste, horasBolsa?, horasExtra? }),
//   fichado, cerrado, enNomina, olvidado, cobraEnDirecto, enCurso(ahora) }.
export function saldoDeTrabajador({ ficha, horas = null, abierto = null }) {
  const turnos = horas?.shifts || [];
  const reparto = tieneBolsa(ficha)
    ? repartirBolsa(turnos.map(s => s.durationHours), bolsaDeFicha(ficha), turnos.map(s => mesDe(s.startEntry?.timestamp)))
    : null;
  const costes = turnos.map((s, i) => (reparto ? reparto[i] : { coste: s.cost }));
  const fichado = costes.reduce((suma, c) => suma + (Number(c.coste) || 0), 0);
  const enNomina = ficha?.statusType === 'payroll';
  const olvidado = !!abierto && isZombieShift(abierto);
  const cobraEnDirecto = !!abierto && !olvidado && !enNomina;
  const enCurso = (ahora) => (cobraEnDirecto
    ? costeEnCurso({ entrada: abierto, ahora, tarifa: abierto.rate || ficha?.hourlyRate || 10, ficha, turnosPrevios: turnos }).coste
    : 0);
  return { costes, fichado, cerrado: (Number(ficha?.currentBalance) || 0) + fichado, enNomina, olvidado, cobraEnDirecto, enCurso };
}
