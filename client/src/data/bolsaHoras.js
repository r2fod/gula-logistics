import { coincideNombre } from './nombresTrabajadores';

// Bolsa mensual de horas (ficha de Saldos con `isSpecialPurse` y `purseInfo`): las
// horas se pagan a `hourlyRate` hasta agotar `totalHours` —contando las ya metidas a
// mano en la bolsa, `consumedHours`— y las que pasan, a `extraRateAfter80h`. Es la
// regla de Saldos & Acuerdos; el Resumen Financiero la usa también, para que los dos
// den el mismo dinero (antes el Resumen cobraba esas horas a la tarifa del fichaje).
//
// Acuerdo por meses (`purseInfo.desde` y `hasta`, AAAA-MM, desde el 05/10): la bolsa
// se renueva cada mes natural de ese periodo y fuera de él todo va a la tarifa extra.
// Las horas a mano de siempre (`consumedHours`) son del mes `desde`; las apuntadas a
// mano en otro mes llevan `horasBolsa` en su concepto (con su `date`). Un turno es del
// mes en que empieza, como en el Resumen. Sin `desde`, una sola bolsa para todo.

export const tieneBolsa = (ficha) => !!(ficha?.isSpecialPurse && ficha.purseInfo);

const MES = /^\d{4}-\d{2}$/;
const porMeses = (p) => MES.test(p?.desde || '');

// Mes (AAAA-MM, hora local) de una fecha; '' si no es válida.
export function mesDe(fecha) {
  const d = new Date(fecha);
  if (!fecha || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ¿Cubre el acuerdo ese mes? (sin meses: siempre).
export function mesConBolsa(purseInfo, mes) {
  if (!porMeses(purseInfo)) return true;
  return !!mes && mes >= purseInfo.desde && (!MES.test(purseInfo.hasta || '') || mes <= purseInfo.hasta);
}

// Lo que la regla necesita de la ficha: su purseInfo y las horas de bolsa apuntadas a
// mano en meses que no son el primero ({ 'AAAA-MM': horas }).
export function bolsaDeFicha(ficha) {
  const aManoPorMes = {};
  (ficha?.breakdown || []).forEach(it => {
    const horas = Number(it?.horasBolsa) || 0;
    const mes = String(it?.date || '').slice(0, 7);
    if (horas > 0 && MES.test(mes)) aManoPorMes[mes] = (aManoPorMes[mes] || 0) + horas;
  });
  return { ...(ficha?.purseInfo || {}), aManoPorMes };
}

// Horas de bolsa apuntadas a mano que cuentan en `mes` (sin meses: todas las de consumedHours).
function aManoEn(p, mes) {
  if (!porMeses(p)) return p.consumedHours || 0;
  return (mes === p.desde ? (p.consumedHours || 0) : 0) + (p.aManoPorMes?.[mes] || 0);
}

// Reparte horas consecutivas (en orden cronológico) entre bolsa y extra:
// [{ horasBolsa, horasExtra, coste }] en el mismo orden. `meses`: el mes (AAAA-MM) de
// cada una; solo cuenta con un acuerdo por meses.
export function repartirBolsa(horas = [], purseInfo = {}, meses = []) {
  const total = purseInfo.totalHours || 0;
  const conMeses = porMeses(purseInfo);
  const gastadas = new Map();
  return horas.map((h, i) => {
    const mes = conMeses ? (meses[i] || '') : '';
    const previas = gastadas.get(mes) || 0;
    const libres = mesConBolsa(purseInfo, mes) ? Math.max(0, total - aManoEn(purseInfo, mes) - previas) : 0;
    const horasBolsa = Math.min(h, libres);
    const horasExtra = Math.max(0, h - horasBolsa);
    gastadas.set(mes, previas + h);
    return { horasBolsa, horasExtra, coste: horasBolsa * (purseInfo.hourlyRate || 0) + horasExtra * (purseInfo.extraRateAfter80h || 0) };
  });
}

// Cómo va la bolsa en el mes de `fecha` con los turnos fichados (cualquier orden):
// { mes, total, gastadas (a mano + fichadas de ese mes, como mucho `total`), libres,
// cubierto }. Sin acuerdo por meses, la bolsa única (mes '').
export function estadoBolsa(ficha, turnos = [], fecha = new Date()) {
  const p = bolsaDeFicha(ficha);
  const conMeses = porMeses(p);
  const mes = conMeses ? mesDe(fecha) : '';
  const cubierto = mesConBolsa(p, mes);
  const fichadas = (turnos || [])
    .filter(t => !conMeses || mesDe(t.startEntry?.timestamp) === mes)
    .reduce((s, t) => s + (t.durationHours || 0), 0);
  const total = cubierto ? (p.totalHours || 0) : 0;
  const gastadas = cubierto ? Math.min(total, aManoEn(p, mes) + fichadas) : 0;
  return { mes, total, gastadas, libres: Math.max(0, total - gastadas), cubierto, porMeses: conMeses };
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
    repartirBolsa(suyos.map(t => t.durationHours || 0), bolsaDeFicha(ficha), suyos.map(t => mesDe(momento(t))))
      .forEach((r, i) => costes.set(suyos[i], r.coste));
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
