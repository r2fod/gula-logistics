// Dibuja el PDF del planning (jsPDF + autotable, A4 vertical, solo Helvetica: sin emojis).
// Se importa SOLO al pulsar «PDF» (import dinámico), así jspdf va en su propio chunk.
// El contenido lo decide `datosDelPdf` (pdfPlanning.js); aquí solo se maquetan.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { plano } from '../utils/texto';

const MARGEN = 12;
const PIE = 16; // espacio reservado abajo para el pie de página
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const UTIL = ANCHO_PAGINA - MARGEN * 2;

const TINTA = [30, 41, 59];
const GRIS = [130, 138, 150];
const AMBAR = [180, 83, 9];
const COLOR_DIA = [30, 41, 59];

// Colores suaves por evento, por orden de aparición (si hay más eventos, se repiten).
const PALETA = [
  [254, 226, 226], [219, 234, 254], [220, 252, 231], [254, 243, 199],
  [237, 233, 254], [207, 250, 254], [252, 231, 243], [236, 252, 203],
];

const ANCHOS = { hora: 25, evento: 36, tarea: 61, equipo: 38, vehiculo: 26 };
const TAM = 8.5;
const RELLENO = 1.8;

const horas = (n) => `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;

function colorDeEventos(modelo) {
  const colores = new Map();
  const anadir = (nombre) => {
    const clave = plano(nombre);
    if (clave && !colores.has(clave)) colores.set(clave, PALETA[colores.size % PALETA.length]);
  };
  modelo.eventos.forEach((e) => anadir(e.nombre));
  modelo.dias.forEach((d) => d.tareas.forEach((t) => anadir(t.evento)));
  return (nombre) => colores.get(plano(nombre)) || null;
}

// Las opciones de la tabla de un día (la misma para medirla y para dibujarla).
function tablaDeDia(doc, dia, colorDe, startY) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TAM);
  const anchoTarea = ANCHOS.tarea - RELLENO * 2;
  const cuerpo = dia.tareas.map((t) => {
    const lineasTarea = doc.splitTextToSize(t.hecha ? `${t.tarea} (hecha)` : t.tarea, anchoTarea);
    const lineasLugar = t.lugar ? doc.splitTextToSize(t.lugar, anchoTarea) : [];
    return [
      { content: t.hora || '-', styles: { fontStyle: 'bold' } },
      { content: t.evento, styles: t.evento && !t.hecha && colorDe(t.evento) ? { fillColor: colorDe(t.evento) } : {} },
      { content: [...lineasTarea, ...lineasLugar].join('\n'), nTarea: lineasTarea.length, lugar: lineasLugar },
      t.equipo.join(', '),
      t.vehiculo,
    ].map((c) => (typeof c === 'object' ? { ...c, hecha: t.hecha } : { content: c, hecha: t.hecha }));
  });
  return {
    startY,
    margin: { left: MARGEN, right: MARGEN, top: 14, bottom: PIE },
    head: [['Hora', 'Evento', 'Tarea', 'Equipo', 'Vehículo']],
    body: cuerpo,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: TAM, cellPadding: RELLENO, textColor: TINTA, lineColor: [226, 232, 240], lineWidth: 0.2, valign: 'top' },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: ANCHOS.hora }, 1: { cellWidth: ANCHOS.evento }, 2: { cellWidth: ANCHOS.tarea },
      3: { cellWidth: ANCHOS.equipo }, 4: { cellWidth: ANCHOS.vehiculo },
    },
    didParseCell: (d) => {
      if (d.section !== 'body') return;
      if (d.cell.raw?.hecha) { d.cell.styles.textColor = GRIS; if (d.column.index !== 1) d.cell.styles.fillColor = [248, 250, 252]; }
    },
    // La tarea va con el lugar debajo, más pequeño y en gris: se pinta aparte.
    willDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 2) return;
      d.cell.lugarPendiente = d.cell.raw.lugar;
      d.cell.text = d.cell.text.slice(0, d.cell.raw.nTarea);
    },
    didDrawCell: (d) => {
      if (d.section !== 'body' || d.column.index !== 2 || !d.cell.lugarPendiente?.length) return;
      const { cell } = d;
      const salto = TAM * 0.3528 * 1.15; // alto de línea en mm
      const y = cell.y + cell.padding('top') + cell.raw.nTarea * salto + 0.4;
      doc.setFontSize(7);
      doc.setTextColor(...GRIS);
      doc.text(cell.lugarPendiente, cell.x + cell.padding('left'), y, { baseline: 'top', lineHeightFactor: 1.15 });
      doc.setFontSize(TAM);
      doc.setTextColor(...TINTA);
    },
  };
}

function nuevoDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
}

// Cabecera de sección (título y una raya fina); devuelve la y donde empieza lo siguiente.
function titulo(doc, y, texto, color = TINTA) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...color);
  doc.text(texto, MARGEN, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y + 1.8, ANCHO_PAGINA - MARGEN, y + 1.8);
  doc.setTextColor(...TINTA);
  return y + 5;
}

// Si lo que viene (`alto` mm) no cabe en lo que queda de la página, página nueva.
function haySitio(doc, y, alto) {
  if (y + alto <= ALTO_PAGINA - PIE) return y;
  doc.addPage();
  return 14;
}

// Un día: título en banda y su tabla. Si cabe entero en una página pero no en lo que
// queda de esta, empieza en una nueva (se mide en un documento aparte).
function dibujarDia(doc, dia, colorDe, y) {
  const medida = nuevoDoc();
  autoTable(medida, tablaDeDia(medida, dia, colorDe, 0));
  const alto = 9 + medida.lastAutoTable.finalY + 2;
  const util = ALTO_PAGINA - PIE - 14;
  y = haySitio(doc, y, alto <= util ? alto : 9 + 30);

  doc.setFillColor(...COLOR_DIA);
  doc.roundedRect(MARGEN, y, UTIL, 7, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(dia.titulo, MARGEN + 3, y + 4.9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${dia.tareas.length} ${dia.tareas.length === 1 ? 'tarea' : 'tareas'}`, ANCHO_PAGINA - MARGEN - 3, y + 4.8, { align: 'right' });
  doc.setTextColor(...TINTA);

  autoTable(doc, tablaDeDia(doc, dia, colorDe, y + 8));
  return doc.lastAutoTable.finalY + 6;
}

// `modelo`: lo que devuelve datosDelPdf. → Blob application/pdf
export function pdfDelPlanning(modelo, { generado = new Date() } = {}) {
  const doc = nuevoDoc();
  const colorDe = colorDeEventos(modelo);
  const { cabecera } = modelo;

  // Cabecera de la primera página.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...TINTA);
  doc.text(doc.splitTextToSize(`Planning · ${cabecera.semana}`, UTIL), MARGEN, 18);
  let y = 18 + (doc.splitTextToSize(`Planning · ${cabecera.semana}`, UTIL).length - 1) * 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text([cabecera.rango, cabecera.estado].filter(Boolean).join('  ·  '), MARGEN, y + 7);
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(`Generado el ${generado.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`, ANCHO_PAGINA - MARGEN, y + 7, { align: 'right' });
  y += 14;

  // Eventos de la semana, con su color.
  if (modelo.eventos.length) {
    y = titulo(doc, y, 'Eventos de la semana');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: 14, bottom: PIE },
      head: [['Evento', 'Pax']],
      body: modelo.eventos.map((e) => [e.nombre, e.pax ? String(e.pax) : '-']),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: TINTA, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 8 },
      columnStyles: { 0: { cellWidth: UTIL - 25 }, 1: { cellWidth: 25, halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'head' && d.column.index === 1) d.cell.styles.halign = 'right';
        if (d.section === 'body' && d.column.index === 0) {
          const color = colorDe(modelo.eventos[d.row.index].nombre);
          if (color) d.cell.styles.fillColor = color;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  modelo.dias.forEach((dia) => { y = dibujarDia(doc, dia, colorDe, y); });

  // Resumen por persona.
  if (modelo.resumen.length) {
    y = haySitio(doc, y, 22);
    y = titulo(doc, y, 'Resumen por persona');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: 14, bottom: PIE },
      head: [['Persona', 'Tareas', 'Horas']],
      body: modelo.resumen.map((p) => [p.nombre, String(p.tareas), horas(p.horas)]),
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: TINTA, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 8 },
      columnStyles: { 0: { cellWidth: UTIL - 60 }, 1: { cellWidth: 30, halign: 'right' }, 2: { cellWidth: 30, halign: 'right' } },
      // Los títulos de las cifras, alineados con ellas.
      didParseCell: (d) => { if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // Tareas sin nadie asignado.
  if (modelo.sinAsignar.length) {
    y = haySitio(doc, y, 22);
    y = titulo(doc, y, `Sin asignar (${modelo.sinAsignar.length})`, AMBAR);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: 14, bottom: PIE },
      head: [['Día', 'Hora', 'Tarea']],
      body: modelo.sinAsignar.map((s) => [s.dia, s.hora || '-', s.texto]),
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: TINTA, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [254, 243, 199], textColor: AMBAR, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 28 }, 2: { cellWidth: UTIL - 60 } },
    });
  }

  // Pie de cada página.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`Gula Logística · página ${i} de ${paginas}`, ANCHO_PAGINA / 2, ALTO_PAGINA - 8, { align: 'center' });
  }

  return doc.output('blob');
}
