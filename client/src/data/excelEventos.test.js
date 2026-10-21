// @vitest-environment node
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { excelDeEventos, nombreDeArchivo, puestoDe } from './excelEventos';

const d = (dia, h, m = 0) => new Date(2026, 9, dia, h, m);
const informe = (evento, extra = {}) => ({
  evento, pax: 160, horas: 9.5, coste: 95,
  filas: [
    { nombre: 'Ana', rol: 'Ayudante Logística', nomina: false, inicio: d(14, 10), fin: d(14, 19), horasTurno: 9, horas: 5.5, tarifa: 10, coste: 55, tareas: ['Preparación de material'], estimado: true, compartido: true, otroDia: false, bolsa: false },
    { nombre: 'Luis', rol: 'Conductor Flota', nomina: false, inicio: d(15, 11), fin: d(15, 15), horasTurno: 4, horas: 4, tarifa: 10, coste: 40, tareas: ['Descarga + montaje'], estimado: true, compartido: false, otroDia: false, bolsa: false },
  ],
  sinFichar: [{ nombre: 'Eva', rol: 'Limpieza Eventos', inicio: d(16, 13, 30), fin: d(16, 17, 30), tarea: 'Descarga' }],
  ...extra,
});
const leer = async (blob) => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(await blob.arrayBuffer()));
  return libro;
};

describe('excelDeEventos — el informe de personal en Excel', () => {
  it('el resumen va delante y luego una hoja por evento, con nombres de hoja válidos', async () => {
    const libro = await leer(await excelDeEventos([informe('Boda Uno'), informe('Boda: Dos/Tres')], { periodo: 'Semana 7' }));
    expect(libro.worksheets.map(h => h.name)).toEqual(['Resumen', 'Boda Uno', 'Boda  Dos Tres']);
  });

  it('cada fila: puesto, nombre, día, entrada y salida como horas, importe con fórmula y su resultado', async () => {
    const hoja = (await leer(await excelDeEventos([informe('Boda Uno')], { periodo: 'Semana 7' }))).getWorksheet('Boda Uno');
    expect(hoja.getCell('A1').value).toBe('PERSONAL · BODA UNO (160 pax)');
    expect(hoja.getRow(5).values.slice(1, 4)).toEqual(['AYUDANTE LOGÍSTICA', 'Ana', 'Mié 14 oct']);
    expect(hoja.getCell('D5').value.toISOString()).toBe('1899-12-30T10:00:00.000Z'); // la hora 10:00 (exceljs la lee como fecha base de Excel)
    expect(hoja.getCell('D5').numFmt).toBe('hh:mm');
    expect(hoja.getCell('I5').value).toEqual({ formula: 'G5*H5', result: 55 });
    expect(hoja.getCell('K5').value).toMatch(/Turno repartido con otros eventos/);
  });

  it('quien no fichó sale en amarillo para rellenar, y el total lo suma si se rellena', async () => {
    const hoja = (await leer(await excelDeEventos([informe('Boda Uno')], { periodo: 'Semana 7' }))).getWorksheet('Boda Uno');
    const fila = [...Array(20).keys()].map(i => i + 1).find(n => hoja.getCell(`B${n}`).value === 'Eva');
    expect(hoja.getCell(`G${fila}`).fill.fgColor.argb).toBe('FFFFFF00');
    expect(hoja.getCell(`I${fila}`).value.formula).toBe(`IF(G${fila}="","",G${fila}*H${fila})`);
    const total = [...Array(30).keys()].map(i => i + 1).find(n => hoja.getCell(`F${n}`).value === 'TOTAL');
    expect(hoja.getCell(`I${total}`).value).toEqual({ formula: `SUM(I5:I${fila})`, result: 95 });
  });

  it('el resumen suma cada persona en cada evento con fórmulas (y pasa de la Z si hay muchos eventos)', async () => {
    const muchos = Array.from({ length: 14 }, (_, i) => informe(`Boda ${i + 1}`));
    const resumen = (await leer(await excelDeEventos(muchos, { periodo: 'Octubre' }))).getWorksheet('Resumen');
    expect(resumen.getCell('C5').value).toEqual({ formula: "SUMIFS('Boda 1'!$G$5:$G$8,'Boda 1'!$B$5:$B$8,$A5)", result: 5.5 });
    const totalEuros = resumen.getRow(4).values.indexOf('€ TOTAL');
    expect(resumen.getColumn(totalEuros).letter).toBe('AF');
    expect(resumen.getCell(`AF5`).value.formula).toMatch(/^D5\+F5\+.*\+AD5$/);
    expect(resumen.getCell(`AF5`).value.result).toBe(55 * 14);
  });

  it('el puesto, corto; el nombre del archivo, sin tildes ni espacios', () => {
    expect(puestoDe('Conductor Flota (Veterano)')).toBe('CONDUCTOR');
    expect(puestoDe('Gula Limpieza & Apoyo')).toBe('LIMPIEZA');
    expect(puestoDe('Jefe de Logística')).toBe('JEFE LOGÍSTICA');
    expect(nombreDeArchivo([{ evento: 'Boda Toño y Ana' }], new Date(2026, 9, 21))).toBe('Logistica_boda_tono_y_ana_2026-10-21.xlsx');
    expect(nombreDeArchivo([{ evento: 'a' }, { evento: 'b' }], new Date(2026, 9, 21))).toBe('Logistica_eventos_2026-10-21.xlsx');
  });
});

describe('excelDeEventos — los resultados ya puestos (lo que se ve sin recalcular)', () => {
  it('BUG evitado: el TOTAL del resumen sumaba lo ya redondeado por persona (102,7 en vez de 102,69)', async () => {
    const fila = (nombre, horas) => ({ nombre, rol: 'x', inicio: d(14, 10), fin: d(14, 12), horasTurno: 2, horas, tarifa: 10, coste: horas * 10, tareas: [], compartido: false, otroDia: false });
    const inf = { evento: 'Boda Uno', pax: null, horas: 0.03, coste: 0.3, filas: [fila('Ana', 0.014), fila('Luis', 0.014), fila('Eva', 0.002)], sinFichar: [] };
    const resumen = (await leer(await excelDeEventos([inf]))).getWorksheet('Resumen');
    const total = [...Array(10).keys()].map(i => i + 1).find(n => resumen.getCell(`A${n}`).value === 'TOTAL');
    expect(resumen.getCell(`C${total}`).value.result).toBe(0.03); // 0,01 + 0,01 + 0,00 si se redondeaba antes
  });

  it('un nombre de hoja largo no acaba en espacio', async () => {
    const libro = await leer(await excelDeEventos([informe('Devolver manteles guinda de tu fiesta')]));
    expect(libro.worksheets[1].name).toBe('Devolver manteles guinda de tu');
  });
});
