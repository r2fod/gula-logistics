import { fechaLocal } from './fechasSemana';
import { formatearEuros } from './formatoFinanciero';
import { mismoNombre } from './nombresTrabajadores';
import { pairShiftsFromEntries } from './shiftCalculations';
import { tarifaDe } from './tarifasPorDefecto';

// `tarifaDe` y `tarifaCorta` (la de su ficha o la por defecto de la base) viven en
// tarifasPorDefecto.js, sin dependencias, para que también las use shiftCalculations.
export { tarifaDe, tarifaCorta, tarifaPorDefecto, transporteDia, sinTarifa } from './tarifasPorDefecto';

// El acuerdo con el que nace la ficha de Saldos de alguien fuera de nómina: «Extra a X € /
// hora (Por Defecto)»; sin tarifa en ninguna parte, lo dice (no se inventa una).
export const textoAcuerdoExtra = (persona) => (tarifaDe(persona) > 0
  ? `Extra a ${formatearEuros(tarifaDe(persona))} / hora (Por Defecto)`
  : 'Extra (sin tarifa: ponla en la ficha de la persona o por defecto en Gestionar equipo)');

// Los fichajes de `nombre` que pasan a `tarifa` «desde el día X» (AAAA-MM-DD): los de ese
// día en adelante que aún no la tienen, sin los de la papelera. El dinero de un turno sale
// de la tarifa de su SALIDA: la de un turno que empezó antes de ese día no se toca (ese
// turno, entero, sigue a la tarifa vieja).
export function fichajesACambiarDeTarifa(fichajes = [], nombre, desdeIso, tarifa) {
  const desde = fechaLocal(desdeIso).getTime();
  const suyos = fichajes.filter(f => !f.deleted && mismoNombre(f.workerName, nombre));
  const deTurnosAnteriores = new Set(pairShiftsFromEntries(suyos).shifts
    .filter(turno => new Date(turno.startEntry.timestamp).getTime() < desde)
    .map(turno => turno.endEntry.id));
  return suyos.filter(f => new Date(f.timestamp).getTime() >= desde && !deTurnosAnteriores.has(f.id) && Number(f.rate) !== tarifa);
}

// Lo que cambia en la ficha de Saldos de alguien al cambiarle la tarifa: con `hourlyRate`
// se valoran los turnos apuntados a mano, y su acuerdo «Extra a X € / hora» dice la nueva.
const ACUERDO_TARIFA = /^Extra (a [\d.,]+\s€ \/ hora|\(sin tarifa)/;
export const tarifaEnFichaDeSaldos = (ficha, tarifa) => ({
  hourlyRate: tarifa,
  agreements: (ficha?.agreements || []).map(acuerdo => (ACUERDO_TARIFA.test(acuerdo) ? `Extra a ${formatearEuros(tarifa)} / hora` : acuerdo)),
});
