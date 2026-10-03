// Conceptos metidos A MANO en Saldos & Acuerdos (ficha.breakdown: { concept, amount,
// date?, tipo? }). Saldos es lo que se le DEBE a cada persona: turnos fichados (se
// suman solos) + esto. Aquí hay dos cosas distintas:
//   · coste apuntado a mano: turnos que no se ficharon, ayuda de transporte, horas
//     de bolsa y ajustes (roturas, saldos iniciales);
//   · PAGOS: dinero ya entregado (efectivo, Bizum, adelantos). Restan del saldo,
//     pero no son coste: el Resumen Financiero los enseña aparte.
//
// Desde el 28/09 cada concepto nuevo lleva `tipo` y `date` (AAAA-MM-DD). Los
// anteriores no: el tipo se deduce del texto y la fecha, de "🕒 15/09 …" (sin año);
// sin fecha solo se pueden colocar en "Todo" (no se inventa en qué semana cayeron).

export const TIPOS_CONCEPTO = {
  turno: 'Turnos apuntados a mano',
  transporte: 'Ayuda de transporte',
  bolsa: 'Horas de bolsa apuntadas a mano',
  ajuste: 'Ajustes (roturas, saldos iniciales…)',
  pago: 'Pagado (efectivo, Bizum, adelantos)',
};

const PAGO = /adelanto|anticip|pag(o|ad|ar)|efectivo|bizum|transferen|liquida|entregad/i;

// Tipo de un concepto (objeto del desglose, o solo su texto e importe).
export function tipoDeConcepto(item = {}, importe = item?.amount) {
  const concepto = typeof item === 'string' ? item : item?.concept;
  if (item && typeof item === 'object' && TIPOS_CONCEPTO[item.tipo]) return item.tipo;
  const texto = String(concepto || '').trim();
  if (/^valor acumulado horas bolsa/i.test(texto)) return 'bolsa';
  if (texto.startsWith('🕒') && /\d h a |\dh a /.test(texto)) return 'turno'; // aunque lleve "+ 10€ transporte"
  if (/transporte/i.test(texto)) return 'transporte';
  if (texto.startsWith('🕒')) return 'turno';
  if (Number(importe) < 0 && PAGO.test(texto)) return 'pago';
  return 'ajuste';
}

const DIA_MS = 24 * 60 * 60 * 1000;

// Fecha del concepto: la guardada (`date`, AAAA-MM-DD) o la escrita al principio del
// texto ("🕒 15/09 …"; sin año: el último 15/09 que no quede más de una semana en el
// futuro respecto a `referencia`). null si no tiene.
export function fechaDeConcepto(item = '', referencia = new Date()) {
  const guardada = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof item === 'object' ? item?.date || '' : '');
  if (guardada) return new Date(Number(guardada[1]), Number(guardada[2]) - 1, Number(guardada[3]));
  const concepto = typeof item === 'object' ? item?.concept : item;
  const m = /^🕒\s*(\d{1,2})\/(\d{1,2})(?!\/\d)/.exec(String(concepto).trim());
  if (!m) {
    // Conceptos heredados (antes del 28/09) sin fecha se asignan a septiembre de 2026
    // para que aparezcan en el desglose mensual (bolsa mensual, ajustes, etc.)
    return new Date(2026, 8, 30, 12, 0, 0);
  }
  const dia = Number(m[1]);
  const mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
  let fecha = new Date(referencia.getFullYear(), mes, dia);
  if (fecha.getMonth() !== mes) return null; // 31/02 y similares
  if (fecha - referencia > 7 * DIA_MS) fecha = new Date(referencia.getFullYear() - 1, mes, dia);
  return fecha;
}

const esNomina = (ficha) => ficha?.statusType === 'payroll';

// Conceptos a mano del personal extra (las fichas de nómina fija no suman: su saldo
// es 0) dentro del periodo `rango` ({ desde, hasta }, nulos = todo). Los que no
// tienen fecha solo entran con `incluirSinFecha` (vista "Todo").
// { porTipo: { tipo: { importe, conceptos } }, items: [{ persona, concepto, importe, tipo, fecha }],
//   total (coste: SIN los pagos), pagado (lo entregado, en positivo),
//   sinFechaFuera: nº de conceptos sin fecha que se han dejado fuera }
export function conceptosDelPeriodo(fichas = [], rango = null, { incluirSinFecha = false, ahora = new Date() } = {}) {
  const porTipo = {};
  const items = [];
  let sinFechaFuera = 0;
  const dentro = (fecha) => !rango?.desde || (fecha >= rango.desde && fecha < rango.hasta);

  (fichas || []).filter(f => f && !esNomina(f)).forEach(ficha => {
    (ficha.breakdown || []).forEach(item => {
      const importe = Number(item?.amount);
      if (!item?.concept || !Number.isFinite(importe)) return;
      const tipo = tipoDeConcepto(item, importe);
      const fecha = fechaDeConcepto(item, ahora);
      const incluido = fecha ? dentro(fecha) : (incluirSinFecha || !rango?.desde);
      if (!incluido) {
        if (!fecha) sinFechaFuera += 1;
        return;
      }
      porTipo[tipo] = porTipo[tipo] || { importe: 0, conceptos: 0 };
      porTipo[tipo].importe += importe;
      porTipo[tipo].conceptos += 1;
      items.push({ persona: ficha.name, concepto: item.concept, importe, tipo, fecha });
    });
  });

  const total = items.filter(it => it.tipo !== 'pago').reduce((suma, it) => suma + it.importe, 0);
  const pagado = -items.filter(it => it.tipo === 'pago').reduce((suma, it) => suma + it.importe, 0);
  return { porTipo, items, total, pagado, sinFechaFuera };
}
