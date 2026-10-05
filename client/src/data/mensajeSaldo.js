import { formatearEuros, formatearEurosConSigno, formatearHoras } from './formatoFinanciero';
import { tipoDeConcepto } from './conceptosSaldos';
import { estadoBolsa, tieneBolsa } from './bolsaHoras';
import { horasDelPeriodo, rangoDePeriodo } from './periodosFinancieros';
import { formatMonthName, formatTimeShort, formatWeekdayDayMonth } from '../utils/dateUtils';

const suma = (items) => items.reduce((total, it) => total + (Number(it.amount) || 0), 0);
const linea = (it) => `• ${it.concept}: ${formatearEurosConSigno(Number(it.amount) || 0)}`;

// Texto de WhatsApp con el saldo de una persona: la MISMA cuenta que se ve en Saldos
// (`saldo` de saldoDeTrabajador, con el turno en curso a `ahora`), sus horas de la
// semana y del mes, y el desglose. Antes el mensaje daba como saldo solo lo apuntado a
// mano, sin los turnos fichados: no cuadraba con la pantalla.
//
// - ficha: su ficha de Saldos. saldo: saldoDeTrabajador(...).
// - turnos: los fichados cerrados de pantalla ([{ concept, amount, timestamp }]); se
//   listan los del mes y los anteriores van en una línea con su total.
// - turnosHoras: sus turnos emparejados (pairShiftsFromEntries), para las horas.
// - incluir: { turnos, aMano, enlace } qué partes lleva. enlace: su enlace personal.
export function mensajeDeSaldo({ ficha, saldo, turnos = [], turnosHoras = [], ahora = new Date(), incluir = {}, enlace = null }) {
  const { turnos: conTurnos = true, aMano: conAMano = true, enlace: conEnlace = true } = incluir;
  const mes = rangoDePeriodo('mes', ahora);
  const semana = rangoDePeriodo('semana', ahora);
  const partes = [];

  partes.push(`🚚 *Gula Logística · Saldo de ${ficha.name}*`);
  partes.push(`_${formatWeekdayDayMonth(ahora)}, ${formatTimeShort(ahora)}_`);
  partes.push('');
  partes.push(`🕒 *Horas:* ${formatearHoras(horasDelPeriodo(turnosHoras, semana))} esta semana · ${formatearHoras(horasDelPeriodo(turnosHoras, mes))} en ${formatMonthName(mes.desde)}`);

  if (saldo.enNomina) {
    partes.push('📌 Nómina fija: estas horas no suman saldo.');
  } else {
    const enCurso = saldo.enCurso(ahora);
    const total = saldo.cerrado + enCurso;
    partes.push(`💰 *${total < 0 ? 'Adelantado de más' : 'Pendiente de cobro'}: ${formatearEurosConSigno(total)}*`);
    if (enCurso > 0) partes.push(`   (con el turno en curso: ${formatearEurosConSigno(enCurso)}; al fichar la salida se redondea a la media hora)`);

    if (conTurnos && turnos.length) {
      const inicioMes = mes.desde.getTime();
      const delMes = turnos.filter(t => new Date(t.timestamp).getTime() >= inicioMes);
      const anteriores = turnos.filter(t => !(new Date(t.timestamp).getTime() >= inicioMes));
      partes.push('', `*Turnos fichados* (${formatearEurosConSigno(suma(turnos))})`);
      delMes.forEach(t => partes.push(linea(t)));
      if (anteriores.length) partes.push(`• ${anteriores.length} ${anteriores.length === 1 ? 'turno anterior' : 'turnos anteriores'}: ${formatearEurosConSigno(suma(anteriores))}`);
    }

    const conceptos = ficha.breakdown || [];
    const pagos = conceptos.filter(it => tipoDeConcepto(it) === 'pago');
    const aMano = conceptos.filter(it => tipoDeConcepto(it) !== 'pago');
    if (conAMano && aMano.length) {
      partes.push('', `*Apuntado a mano* (${formatearEurosConSigno(suma(aMano))})`);
      aMano.forEach(it => partes.push(linea(it)));
    }
    if (conAMano && pagos.length) {
      partes.push('', `*Pagos y adelantos* (${formatearEurosConSigno(suma(pagos))})`);
      pagos.forEach(it => partes.push(linea(it)));
    }

    if (tieneBolsa(ficha)) {
      const p = ficha.purseInfo;
      const extra = formatearEuros(p.extraRateAfter80h || 0);
      const bolsa = estadoBolsa(ficha, turnosHoras, ahora);
      if (!bolsa.porMeses) partes.push('', `📦 *Bolsa:* ${formatearHoras(p.consumedHours || 0)} de ${formatearHoras(p.totalHours || 0)} gastadas; las siguientes, a ${extra}/h.`);
      else if (bolsa.cubierto) partes.push('', `📦 *Bolsa de ${formatMonthName(mes.desde)}:* ${formatearHoras(bolsa.gastadas)} de ${formatearHoras(bolsa.total)} gastadas; las siguientes, a ${extra}/h.`);
      else partes.push('', `📦 *Bolsa:* ${formatMonthName(mes.desde)} queda fuera del acuerdo; todas las horas, a ${extra}/h.`);
    }
  }

  if (conEnlace && enlace) partes.push('', `🔗 Míralo al día en tu enlace (es personal): ${enlace}`);
  return partes.join('\n');
}
