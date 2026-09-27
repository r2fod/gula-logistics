import { formatearEuros, formatearHoras, formatearEurosConSigno } from './formatoFinanciero';
import { TIPOS_CONCEPTO } from './conceptosSaldos';

// Texto del Resumen Financiero para pegar en WhatsApp (antes estaba en el informe de
// Nóminas y solo servía para la semana abierta; ahora es el del periodo elegido).
// `personas`: [{ name, isPayroll, totalHours, totalCost }] con horas en el periodo.
// `conceptos` (conceptosDelPeriodo) y `estimado` (estimarHorasPlanning) son opcionales.
export function textoResumenWhatsApp({ etiqueta, personas = [], totalExtras = 0, totalNomina = 0, totalHoras = 0, conceptos = null, estimado = null }) {
  const lineas = [
    '📋 *Gula Logística — Resumen de personal*',
    `📅 ${etiqueta}`,
    '',
    `💶 *Extras a pagar:* ${formatearEuros(totalExtras)}`,
    `⭐ *Valoración nóminas (interna):* ${formatearEuros(totalNomina)}`,
    `⏱️ *Horas fichadas:* ${formatearHoras(totalHoras)}`,
  ];

  if (personas.length) {
    lineas.push('', ...personas.map(p => `👤 *${p.name}*${p.isPayroll ? ' (nómina)' : ''}: ${formatearHoras(p.totalHours)} · ${p.isPayroll ? `valoración ${formatearEuros(p.totalCost)}` : formatearEuros(p.totalCost)}`));
  }

  if (conceptos?.items?.length) {
    lineas.push('', '✍️ *Apuntado a mano en Saldos & Acuerdos:*');
    Object.entries(conceptos.porTipo).forEach(([tipo, { importe }]) => lineas.push(`• ${TIPOS_CONCEPTO[tipo]}: ${formatearEurosConSigno(importe)}`));
    lineas.push(`💰 *Extras + apuntado a mano:* ${formatearEuros(totalExtras + conceptos.total)}`);
  }

  if (estimado?.porPersona?.length) {
    lineas.push('', `📅 *Previsto según el planning (no son fichajes):* ${formatearHoras(estimado.horasExtra)} de extras · ${formatearEuros(estimado.costeExtra)}`);
  }

  return lineas.join('\n');
}
