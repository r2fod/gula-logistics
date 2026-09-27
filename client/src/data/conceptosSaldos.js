// Conceptos metidos A MANO en Saldos & Acuerdos (ficha.breakdown: { concept, amount }).
// Los turnos fichados no están aquí (se suman solos desde los fichajes); esto es lo
// que el Resumen Financiero no veía: turnos apuntados a mano, ayuda de transporte,
// horas de bolsa y ajustes (roturas, adelantos, saldos iniciales).
//
// No llevan campo de fecha: los turnos y el transporte la llevan escrita al
// principio del texto ("🕒 15/09 …", sin año); la línea de bolsa y los ajustes no,
// así que solo se pueden colocar en "Todo" (no se inventa en qué semana cayeron).

export const TIPOS_CONCEPTO = {
  turno: 'Turnos apuntados a mano',
  transporte: 'Ayuda de transporte',
  bolsa: 'Horas de bolsa apuntadas a mano',
  ajuste: 'Ajustes (roturas, adelantos, saldos iniciales…)',
};

export function tipoDeConcepto(concepto = '') {
  const texto = String(concepto).trim();
  if (/^valor acumulado horas bolsa/i.test(texto)) return 'bolsa';
  if (/transporte/i.test(texto)) return 'transporte';
  if (texto.startsWith('🕒')) return 'turno';
  return 'ajuste';
}

const DIA_MS = 24 * 60 * 60 * 1000;

// Fecha escrita al principio ("🕒 15/09 …"). Sin año: el último 15/09 que no quede
// más de una semana en el futuro respecto a `referencia`. null si no la lleva.
export function fechaDeConcepto(concepto = '', referencia = new Date()) {
  const m = /^🕒\s*(\d{1,2})\/(\d{1,2})(?!\/\d)/.exec(String(concepto).trim());
  if (!m) return null;
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
//   total, sinFechaFuera: nº de conceptos sin fecha que se han dejado fuera }
export function conceptosDelPeriodo(fichas = [], rango = null, { incluirSinFecha = false, ahora = new Date() } = {}) {
  const porTipo = {};
  const items = [];
  let sinFechaFuera = 0;
  const dentro = (fecha) => !rango?.desde || (fecha >= rango.desde && fecha < rango.hasta);

  (fichas || []).filter(f => f && !esNomina(f)).forEach(ficha => {
    (ficha.breakdown || []).forEach(item => {
      const importe = Number(item?.amount);
      if (!item?.concept || !Number.isFinite(importe)) return;
      const tipo = tipoDeConcepto(item.concept);
      const fecha = fechaDeConcepto(item.concept, ahora);
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

  const total = items.reduce((suma, it) => suma + it.importe, 0);
  return { porTipo, items, total, sinFechaFuera };
}
