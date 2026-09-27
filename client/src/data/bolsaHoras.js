import { coincideNombre } from './nombresTrabajadores';

// Bolsa mensual de horas (ficha de Saldos con `isSpecialPurse` y `purseInfo`): las
// horas se pagan a `hourlyRate` hasta agotar `totalHours` —contando las ya metidas a
// mano en la bolsa, `consumedHours`— y las que pasan, a `extraRateAfter80h`. Es la
// regla de Saldos & Acuerdos; el Resumen Financiero la usa también, para que los dos
// den el mismo dinero (antes el Resumen cobraba esas horas a la tarifa del fichaje).

export const tieneBolsa = (ficha) => !!(ficha?.isSpecialPurse && ficha.purseInfo);

// Reparte horas consecutivas (en orden cronológico) entre bolsa y extra:
// [{ horasBolsa, horasExtra, coste }] en el mismo orden.
export function repartirBolsa(horas = [], purseInfo = {}) {
  const total = purseInfo.totalHours || 0;
  let consumidas = purseInfo.consumedHours || 0;
  return horas.map(h => {
    const horasBolsa = Math.min(h, Math.max(0, total - consumidas));
    const horasExtra = Math.max(0, h - horasBolsa);
    consumidas += h;
    return { horasBolsa, horasExtra, coste: horasBolsa * (purseInfo.hourlyRate || 0) + horasExtra * (purseInfo.extraRateAfter80h || 0) };
  });
}

const momento = (turno) => new Date(turno.startEntry?.timestamp).getTime() || 0;

// Los turnos (pairShiftsFromEntries, TODOS: la bolsa se va gastando con el
// histórico) con el coste de quien tiene bolsa recalculado como en Saldos. Los
// demás se devuelven tal cual. Las subtareas se reparten por su duración, para
// que el desglose por evento sume lo mismo que el turno.
export function aplicarTarifaDeBolsa(turnos = [], fichas = []) {
  const conBolsa = (fichas || []).filter(tieneBolsa);
  if (!conBolsa.length) return turnos;

  const costes = new Map();
  conBolsa.forEach(ficha => {
    const suyos = turnos.filter(t => coincideNombre(t.workerName, ficha.name)).sort((a, b) => momento(a) - momento(b));
    repartirBolsa(suyos.map(t => t.durationHours || 0), ficha.purseInfo).forEach((r, i) => costes.set(suyos[i], r.coste));
  });
  if (!costes.size) return turnos;

  return turnos.map(t => {
    if (!costes.has(t)) return t;
    const coste = costes.get(t);
    const horas = t.durationHours || 0;
    return {
      ...t,
      cost: coste,
      rate: horas > 0 ? coste / horas : t.rate,
      subTasks: (t.subTasks || []).map(st => ({ ...st, cost: horas > 0 ? (coste * (st.durationHours || 0)) / horas : 0 })),
    };
  });
}
