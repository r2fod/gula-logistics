import ExcelJS from 'exceljs';
import { formatDayMonthShort, formatWeekdayShortDay } from '../utils/dateUtils';
import { plano } from '../utils/texto';

// El informe de horas y coste por evento (informeDeEventos) en un Excel cuidado: delante un
// resumen por persona y, después, una hoja por evento con su personal (entrada, salida,
// horas, €/hora e importe). Los importes y totales son FÓRMULAS (si se corrige una hora o
// una tarifa, todo se recalcula), con su resultado ya puesto para que se vea igual en una
// vista previa. Quien estaba en el planning y no fichó sale en amarillo para completarlo.
// Este archivo (y exceljs) solo se carga al pulsar «Excel» (ver DescargarExcel).

const LETRA = 'Arial';
const VERDE = 'FFD9EAD3';
const CREMA = 'FFFCE5CD';
const AMARILLO = 'FFFFFF00';
const AZUL = 'FF0000FF'; // dato sacado de la app
const BORDE = { style: 'thin', color: { argb: 'FF999999' } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const EUROS = '#,##0.00 "€"';
const HORAS = '0.00';

const COLUMNAS = [
  ['PUESTO', 20], ['NOMBRE', 16], ['DÍA', 13], ['ENTRADA', 10], ['SALIDA', 10], ['HORAS TURNO', 11],
  ['HORAS EVENTO', 12], ['€/HORA', 10], ['IMPORTE', 13], ['TAREA (PLANNING)', 48], ['NOTA', 44],
];

// El puesto, corto y como en las hojas de evento («CONDUCTOR», «LIMPIEZA»…).
export function puestoDe(rol = '') {
  const p = plano(rol);
  if (/jef/.test(p)) return 'JEFE LOGÍSTICA';
  if (/limpieza|vajilla/.test(p)) return 'LIMPIEZA';
  if (/conductor/.test(p)) return 'CONDUCTOR';
  if (/ayudante/.test(p)) return 'AYUDANTE LOGÍSTICA';
  if (/apoyo/.test(p)) return 'APOYO LOGÍSTICA';
  return String(rol || 'LOGÍSTICA').toUpperCase();
}

const diaCorto = (d) => `${formatWeekdayShortDay(d)} ${formatDayMonthShort(d).replace(/^\d+\s*/, '')}`.replace(/^./, c => c.toUpperCase());
// Una hora como fracción del día (lo que Excel entiende por hora), sin líos de zona horaria.
const horaExcel = (d) => (d.getHours() * 60 + d.getMinutes()) / 1440;
const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;

// Nombre de hoja válido (≤ 31, sin []:*?/\) y sin repetir; entre comillas en las fórmulas.
function nombreDeHoja(nombre, usados) {
  const base = String(nombre || 'Evento').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31).trim() || 'Evento';
  let hoja = base;
  for (let n = 2; usados.has(hoja.toLowerCase()); n++) hoja = `${base.slice(0, 28)} ${n}`;
  usados.add(hoja.toLowerCase());
  return hoja;
}
const enFormula = (hoja) => `'${hoja.replace(/'/g, "''")}'`;

function celda(fila, col, valor, { fuente = {}, relleno = null, formato = null, ajustar = false, alinear = null } = {}) {
  const c = fila.getCell(col);
  c.value = valor;
  c.font = { name: LETRA, size: 10, ...fuente };
  c.border = BORDES;
  if (relleno) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
  if (formato) c.numFmt = formato;
  c.alignment = { vertical: 'top', wrapText: ajustar, ...(alinear ? { horizontal: alinear } : {}) };
  return c;
}

function cabecera(hoja, filaN, titulos) {
  const fila = hoja.getRow(filaN);
  titulos.forEach((t, i) => celda(fila, i + 1, t, { fuente: { bold: true }, relleno: VERDE, ajustar: true, alinear: 'center' }));
  fila.height = 28;
}

const notaDeFila = (f) => [
  f.compartido ? 'Turno repartido con otros eventos (por pax si los hay)' : '',
  f.otroDia ? 'Ese día no tenía tarea de este evento: repartido según sus tareas de la semana' : '',
  f.nomina ? 'Nómina fija: coste de control interno' : '',
  f.bolsa ? 'Bolsa de horas: €/hora medio del turno (unas horas a la tarifa de bolsa y otras a la extra)' : '',
].filter(Boolean).join('. ');

function hojaDeEvento(libro, informe, nombreHoja, { periodo, generado }) {
  const hoja = libro.addWorksheet(nombreHoja, { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  COLUMNAS.forEach(([, ancho], i) => { hoja.getColumn(i + 1).width = ancho; });
  hoja.getCell('A1').value = `PERSONAL · ${informe.evento.toUpperCase()}${informe.pax ? ` (${informe.pax} pax)` : ''}`;
  hoja.getCell('A1').font = { name: LETRA, size: 13, bold: true };
  hoja.getCell('A2').value = `${periodo} · generado el ${generado.toLocaleDateString('es-ES')} desde Gula Logística (fichajes de la app)`;
  hoja.getCell('A2').font = { name: LETRA, size: 9, italic: true, color: { argb: 'FF555555' } };
  cabecera(hoja, 4, COLUMNAS.map(([t]) => t));

  let n = 5;
  informe.filas.forEach(f => {
    const fila = hoja.getRow(n);
    const dato = { fuente: { color: { argb: AZUL } }, relleno: CREMA };
    celda(fila, 1, puestoDe(f.rol), { relleno: CREMA });
    celda(fila, 2, f.nombre, { relleno: CREMA });
    celda(fila, 3, diaCorto(f.inicio), { relleno: CREMA });
    celda(fila, 4, horaExcel(f.inicio), { ...dato, formato: 'hh:mm' });
    celda(fila, 5, horaExcel(f.fin), { ...dato, formato: 'hh:mm' });
    celda(fila, 6, f.horasTurno, { ...dato, formato: HORAS });
    celda(fila, 7, f.horas, { ...dato, formato: HORAS });
    celda(fila, 8, f.tarifa, { ...dato, formato: EUROS });
    celda(fila, 9, { formula: `G${n}*H${n}`, result: redondear(f.horas * f.tarifa) }, { relleno: CREMA, formato: EUROS });
    celda(fila, 10, f.tareas.join('; ') || '—', { relleno: CREMA, ajustar: true });
    celda(fila, 11, notaDeFila(f), { relleno: CREMA, ajustar: true });
    n += 1;
  });

  if (informe.sinFichar.length) {
    hoja.getCell(`A${n}`).value = 'EN EL PLANNING PERO SIN FICHAJE · rellena las celdas amarillas si trabajaron (si no, déjalas en blanco)';
    hoja.getCell(`A${n}`).font = { name: LETRA, size: 10, bold: true, color: { argb: 'FF9C0006' } };
    n += 1;
    informe.sinFichar.forEach(t => {
      const fila = hoja.getRow(n);
      celda(fila, 1, puestoDe(t.rol));
      celda(fila, 2, t.nombre);
      celda(fila, 3, diaCorto(t.inicio));
      [4, 5, 7, 8].forEach(col => celda(fila, col, null, { relleno: AMARILLO, formato: col <= 5 ? 'hh:mm' : col === 7 ? HORAS : EUROS }));
      celda(fila, 6, null, { formato: HORAS });
      celda(fila, 9, { formula: `IF(G${n}="","",G${n}*H${n})`, result: '' }, { formato: EUROS });
      celda(fila, 10, `${t.tarea} (${t.inicio.toTimeString().slice(0, 5)}-${t.fin.toTimeString().slice(0, 5)})`, { ajustar: true });
      celda(fila, 11, 'No fichó ese día: no suma hasta rellenar horas y €/hora', { ajustar: true });
      n += 1;
    });
  }

  const ultima = n - 1;
  const total = n + 1;
  const filaTotal = hoja.getRow(total);
  celda(filaTotal, 6, 'TOTAL', { fuente: { bold: true } });
  celda(filaTotal, 7, { formula: `SUM(G5:G${ultima})`, result: redondear(informe.horas) }, { fuente: { bold: true }, relleno: VERDE, formato: HORAS });
  celda(filaTotal, 9, { formula: `SUM(I5:I${ultima})`, result: redondear(informe.filas.reduce((s, f) => s + f.horas * f.tarifa, 0)) }, { fuente: { bold: true }, relleno: VERDE, formato: EUROS });

  [
    'Cómo se ha calculado:',
    'Entrada y salida: las del fichaje de la jornada. Horas turno: las que se pagan (a la media hora).',
    'Horas evento: la parte del turno que fue para este evento, con el mismo reparto que el Resumen financiero de la app. Si se fichó solo la jornada (sin la tarea), se reparte según las tareas del planning de esa persona; si un turno sirvió a varios eventos, se reparte por pax.',
    'Importe = horas evento × €/hora (la tarifa del fichaje). No incluye ayuda de transporte ni lo apuntado a mano en Saldos.',
    'Azul: dato de la app. Amarillo: para rellenar a mano.',
  ].forEach((texto, i) => {
    const c = hoja.getCell(`A${total + 2 + i}`);
    c.value = texto;
    c.font = { name: LETRA, size: 9, italic: i > 0, bold: i === 0, color: { argb: 'FF555555' } };
  });
  return { primera: 5, ultima };
}

function hojaResumen(libro, informes, hojas, { periodo, generado }) {
  const hoja = libro.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const titulos = ['NOMBRE', 'PUESTO', ...informes.flatMap(i => [`HORAS · ${i.evento}`, `€ · ${i.evento}`]), 'HORAS TOTAL', '€ TOTAL'];
  titulos.forEach((t, i) => { hoja.getColumn(i + 1).width = i < 2 ? 18 : 14; });
  hoja.getCell('A1').value = informes.length === 1 ? `RESUMEN · ${informes[0].evento.toUpperCase()}` : `RESUMEN · ${informes.length} EVENTOS`;
  hoja.getCell('A1').font = { name: LETRA, size: 13, bold: true };
  hoja.getCell('A2').value = `${periodo} · generado el ${generado.toLocaleDateString('es-ES')} desde Gula Logística`;
  hoja.getCell('A2').font = { name: LETRA, size: 9, italic: true, color: { argb: 'FF555555' } };
  cabecera(hoja, 4, titulos);

  const personas = [];
  informes.forEach(i => [...i.filas, ...i.sinFichar].forEach(f => { if (!personas.some(p => p.nombre === f.nombre)) personas.push({ nombre: f.nombre, rol: f.rol }); }));
  const col = (k) => hoja.getColumn(k + 1).letter; // con muchos eventos pasa de la Z (AA, AB…)
  const crudos = new Array(titulos.length).fill(0); // para el resultado del TOTAL, sin redondeos por persona
  let n = 5;
  personas.forEach(p => {
    const fila = hoja.getRow(n);
    celda(fila, 1, p.nombre);
    celda(fila, 2, puestoDe(p.rol));
    let horasTotal = 0;
    let eurosTotal = 0;
    informes.forEach((inf, k) => {
      const { nombre, primera, ultima } = hojas[k];
      const suyas = inf.filas.filter(f => f.nombre === p.nombre);
      const horasCrudas = suyas.reduce((s, f) => s + f.horas, 0);
      const eurosCrudos = suyas.reduce((s, f) => s + f.horas * f.tarifa, 0);
      const h = redondear(horasCrudas);
      const e = redondear(eurosCrudos);
      horasTotal += horasCrudas;
      eurosTotal += eurosCrudos;
      crudos[2 + k * 2] += horasCrudas;
      crudos[3 + k * 2] += eurosCrudos;
      const rango = (c) => `${enFormula(nombre)}!$${c}$${primera}:$${c}$${ultima}`;
      celda(fila, 3 + k * 2, { formula: `SUMIFS(${rango('G')},${rango('B')},$A${n})`, result: h }, { fuente: { color: { argb: 'FF008000' } }, formato: HORAS });
      celda(fila, 4 + k * 2, { formula: `SUMIFS(${rango('I')},${rango('B')},$A${n})`, result: e }, { fuente: { color: { argb: 'FF008000' } }, formato: EUROS });
    });
    const horas = Array.from({ length: informes.length }, (_, k) => `${col(2 + k * 2)}${n}`).join('+');
    const euros = Array.from({ length: informes.length }, (_, k) => `${col(3 + k * 2)}${n}`).join('+');
    celda(fila, 3 + informes.length * 2, { formula: horas, result: redondear(horasTotal) }, { formato: HORAS });
    celda(fila, 4 + informes.length * 2, { formula: euros, result: redondear(eurosTotal) }, { formato: EUROS });
    crudos[2 + informes.length * 2] += horasTotal;
    crudos[3 + informes.length * 2] += eurosTotal;
    n += 1;
  });
  const total = hoja.getRow(n);
  celda(total, 1, 'TOTAL', { fuente: { bold: true }, relleno: VERDE });
  celda(total, 2, '', { relleno: VERDE });
  for (let k = 2; k < titulos.length; k++) {
    const L = col(k);
    celda(total, k + 1, { formula: `SUM(${L}5:${L}${n - 1})`, result: redondear(crudos[k]) }, { fuente: { bold: true }, relleno: VERDE, formato: k % 2 === 0 ? HORAS : EUROS });
  }
  [
    'Verde: suma de las hojas de cada evento, donde está el detalle (entrada, salida, tarea).',
    'Si se fichó solo la jornada, las horas de cada evento salen del planning (estimadas, como en el Resumen financiero).',
  ].forEach((texto, i) => {
    const c = hoja.getCell(`A${n + 2 + i}`);
    c.value = texto;
    c.font = { name: LETRA, size: 9, italic: true, color: { argb: 'FF555555' } };
  });
}

// → Blob .xlsx. `periodo`: el texto del periodo del Resumen («Semana 7 · 13 oct – 19 oct 2026»).
export async function excelDeEventos(informes = [], { periodo = '', generado = new Date() } = {}) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Gula Logística';
  libro.created = generado;
  const usados = new Set(['resumen']);
  const nombres = informes.map(i => nombreDeHoja(i.evento, usados));
  // El resumen va primero pero sus fórmulas apuntan a las hojas de cada evento: se crean
  // antes y luego se pone el resumen delante.
  const hojas = informes.map((informe, k) => ({ nombre: nombres[k], ...hojaDeEvento(libro, informe, nombres[k], { periodo, generado }) }));
  hojaResumen(libro, informes, hojas, { periodo, generado });
  libro.getWorksheet('Resumen').orderNo = -1; // delante de las de cada evento
  libro.calcProperties.fullCalcOnLoad = true;
  const datos = await libro.xlsx.writeBuffer();
  return new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Nombre del archivo: «Logistica_Boda_Ana_y_Luis_2026-10-21.xlsx» o «Logistica_eventos_…».
export const nombreDeArchivo = (informes = [], fecha = new Date()) => {
  const parte = informes.length === 1 ? plano(informes[0].evento).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') : 'eventos';
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `Logistica_${parte}_${dia}.xlsx`;
};
