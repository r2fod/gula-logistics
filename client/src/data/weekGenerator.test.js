import { describe, it, expect } from 'vitest';
import { generarBorrador, martesDeSemana, formatearRango, nombreDeEvento, weekIdParaInicio } from './weekGenerator';
import { parseWeekRange, getDayLabel } from './taskPlanning';
import { parseEventAndTask, splitEventNames, EVENT_CATEGORIES } from './eventNaming';
import { validateGeneratedSchedule } from './geminiScheduleService';
import { crearRestriccion } from './disponibilidad';
import { tareasDelPlanning } from './optimizadorPlanning';

// Equipo y calendario FICTICIOS con la misma forma que los reales.
const ROSTER = [
  { name: 'Bruno', role: 'Conductor Flota (Veterano)' },
  { name: 'Carlos', role: 'Conductor Flota (Veterano)' },
  { name: 'Diego', role: 'Conductor & Backup' },
  { name: 'Elena', role: 'Ayudante Logística / Prepara Eventos / Verifica Checklist' },
  { name: 'Rafael', role: 'Apoyo Logística & Prep' },
  { name: 'Lara', role: 'Gula Limpieza Eventos' },
  { name: 'Nico', role: 'Gula Limpieza & Apoyo' },
  { name: 'Óscar', role: 'Jefe de Logística' },
];
const PLANTILLA = {
  team: [{ role: 'Flota', members: 'Bruno, Carlos y Diego' }],
  trucks: [{ name: 'Camión Gula', tag: 'PROPIO' }, { name: 'Camión Covey', tag: 'ALQUILER' }, { name: 'Camión Albacar', tag: 'ALQUILER' }],
};
const APUNTES = [
  { id: '1', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'CAFE + COMIDA ACME', pax: 35, sitio: 'Calle Ejemplo, 3', hora: '08:30' },
  { id: '2', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'EVENTO DELTA 25 PAX', pax: 55, hora: '11:00' },
  { id: '3', fecha: '2026-09-24', tipo: 'boda', titulo: 'DESCARGA PROVEEDOR FINCA NORTE' },
  { id: '4', fecha: '2026-09-25', tipo: 'boda', titulo: 'Boda Ana', pax: 60, sitio: 'Molino Uno' },
  { id: '5', fecha: '2026-09-25', tipo: 'boda', titulo: 'Boda Ana Y Luis', sitio: 'Molino Uno' },
  { id: '6', fecha: '2026-09-25', tipo: 'recogida', titulo: 'Recoger generadores 7K, furgo 18:00' },
  { id: '7', fecha: '2026-09-26', tipo: 'boda', titulo: 'Boda Marta e Ivan', pax: 300, sitio: 'Finca Sur' },
  { id: '8', fecha: '2026-09-09', hasta: '2026-10-19', tipo: 'recogida', titulo: 'Camión Covey' },
  { id: '9', fecha: '2026-09-23', tipo: 'tarea', titulo: 'VISITA TECNICA' },
  { id: '10', fecha: '2026-09-26', tipo: 'cerrado', titulo: 'Día completo' },
];
const INICIO = new Date(2026, 8, 22);
const generar = (apuntes = APUNTES, roster = ROSTER, extra = {}) =>
  generarBorrador({ inicio: INICIO, apuntes, roster, plantilla: PLANTILLA, nombre: 'Semana 5', ahora: new Date(2026, 8, 21, 12, 0), ...extra });

const todas = (w) => [
  ...Object.entries(w.schedule).flatMap(([dia, d]) => d.tasks.map(t => ({ dia, ...t }))),
  ...w.saturdaySpecial.weddings.map(t => ({ dia: 'sabado', ...t })),
  ...w.sundayMonday.tasks.map(t => ({ dia: (t.targetDay || 'domingo').toLowerCase(), ...t })),
];
const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

describe('fechas', () => {
  it('martesDeSemana: el lunes es la cola de la semana anterior', () => {
    expect(martesDeSemana(new Date(2026, 8, 21)).getDate()).toBe(15); // lunes 21 -> semana del 15
    expect(martesDeSemana(new Date(2026, 8, 22)).getDate()).toBe(22);
    expect(martesDeSemana(new Date(2026, 8, 27)).getDate()).toBe(22); // domingo
  });
  it('formatearRango se lee de vuelta con parseWeekRange (también cruzando mes)', () => {
    expect(formatearRango(new Date(2026, 8, 22))).toBe('Del 22 al 27 de Septiembre de 2026');
    const r = parseWeekRange(formatearRango(new Date(2026, 8, 29)), new Date(2026, 8, 21));
    expect([r.start.getMonth(), r.start.getDate(), r.end.getMonth(), r.end.getDate()]).toEqual([8, 29, 9, 4]);
    expect(weekIdParaInicio(new Date(2026, 8, 22))).toBe('week_auto_2026-09-22');
  });
});

describe('nombreDeEvento', () => {
  it('pone el prefijo, quita los pax del título y arregla mayúsculas', () => {
    expect(nombreDeEvento({ tipo: 'corporativo', titulo: 'CAFE + COMIDA ACME' })).toBe('Evento Cafe + Comida Acme');
    expect(nombreDeEvento({ tipo: 'corporativo', titulo: 'EVENTO DELTA 25 PAX' })).toBe('Evento Delta');
    expect(nombreDeEvento({ tipo: 'boda', titulo: 'Boda Ana Y Luis' })).toBe('Boda Ana y Luis');
    expect(nombreDeEvento({ tipo: 'boda', titulo: 'Marta e Ivan' })).toBe('Boda Marta e Ivan');
  });
});

describe('generarBorrador — semana del 22 al 27', () => {
  const { week, resumen } = generar();
  const tareas = todas(week);

  it('es un BORRADOR con el rango, los avisos y pasa la validación de forma', () => {
    expect(week.meta).toMatchObject({ status: 'Borrador', dateRange: 'Del 22 al 27 de Septiembre de 2026', generadoDesde: 'calendario' });
    expect(validateGeneratedSchedule(week)).toBe('');
    expect(getDayLabel(week, 'lunes', new Date(2026, 8, 21))).toBe('Lunes 28');
    expect(week.schedule.martes.title).toBe('Martes 22');
  });

  it('cuenta lo importante: 4 eventos (la boda duplicada se fusiona), 1 recogida de alquiler y 1 descarga', () => {
    expect(resumen).toMatchObject({ eventos: 4, alquileres: 1, descargas: 1 });
    expect(week.events).toEqual(expect.arrayContaining([{ name: 'Boda Ana y Luis', pax: 60 }, { name: 'Boda Marta e Ivan', pax: 300 }, { name: 'Evento Delta', pax: 55 }, { name: 'Evento Cafe + Comida Acme', pax: 35 }]));
    expect(week.events).toHaveLength(4);
  });

  it('BUG evitado: usa la HORA DE INICIO del evento (el café de las 08:30 se monta antes, no a las 09:00)', () => {
    const cafeMontaje = week.schedule.martes.tasks.find(t => /Cafe.*Descarga \+ Montaje/.test(t.text));
    expect(minutos(cafeMontaje.timeFrame.split(' - ')[1])).toBeLessThanOrEqual(minutos('08:30') - 60);
    expect(minutos(cafeMontaje.timeFrame.slice(0, 5))).toBeGreaterThanOrEqual(6 * 60 + 30);
    // empieza tan pronto que la carga cae en el lunes (semana anterior): se avisa en vez de inventar
    expect(resumen.avisos.some(a => /Cafe.*empieza a las 08:30.*semana anterior/.test(a))).toBe(true);
    expect(week.schedule.martes.tasks.some(t => /Cafe.*Carga de material/.test(t.text))).toBe(false);
  });

  it('el evento de las 11:00 sí lleva carga, montaje, supervisión, recogida y limpieza el mismo día', () => {
    const delta = week.schedule.martes.tasks.filter(t => t.text.startsWith('Evento Delta - '));
    expect(delta.map(t => t.text.split(' - ')[1])).toEqual(expect.arrayContaining(['Carga de material', 'Descarga + Montaje Estructura', 'Supervisión', 'Recogida y vuelta a base']));
    expect(week.schedule.martes.tasks.some(t => t.text.startsWith('Limpieza Eventos - ') && t.assigned.every(n => ['Lara', 'Nico'].includes(n)))).toBe(true);
  });

  it('la "descarga" apuntada como boda va como descarga adelantada de la boda del sábado', () => {
    const d = week.schedule.jueves.tasks.find(t => /Descarga adelantada/.test(t.text));
    expect(d.text.startsWith('Boda Marta e Ivan - ')).toBe(true);
    expect(d.assigned).toHaveLength(2);
  });

  it('la recogida de alquiler del calendario: una sola persona, a su hora, bajo Logística Preparación', () => {
    const r = week.schedule.viernes.tasks.find(t => /generadores/.test(t.text));
    expect(r.text).toBe('Logística Preparación - Recoger generadores 7K, furgo');
    expect(r.timeFrame).toBe('18:00 - 19:00');
    expect(r.assigned).toHaveLength(1);
  });

  it('la boda del sábado va a la lista de bodas (montaje + recogida) y el domingo lleva su recogida con targetDay', () => {
    expect(week.saturdaySpecial.weddings.map(w => w.event)).toEqual(['Boda Marta e Ivan', 'Boda Marta e Ivan']);
    expect(week.saturdaySpecial.title).toContain('300 pax');
    const dom = week.sundayMonday.tasks.filter(t => t.targetDay === 'Domingo');
    expect(dom.some(t => /Terminar de recoger/.test(t.text))).toBe(true);
    expect(dom.some(t => t.text.startsWith('Limpieza Eventos - '))).toBe(true);
  });

  it('las tareas del calendario, los días cerrados y los alquileres continuos NO generan nada', () => {
    const texto = JSON.stringify(week);
    expect(texto).not.toContain('VISITA TECNICA');
    expect(texto).not.toContain('Día completo');
    expect(tareas.some(t => /Covey/.test(t.text || ''))).toBe(false);
  });

  it('INVARIANTES: todo con "Evento - Tarea", eventos válidos, ids únicos, equipo del roster, nada completado, sin solapes', () => {
    const conocidos = new Set([...week.events.map(e => e.name), ...EVENT_CATEGORIES]);
    const ids = {};
    tareas.forEach(t => {
      if (t.text) {
        const p = parseEventAndTask(t.text);
        expect(p.explicit).toBe(true);
        splitEventNames(p.eventName).forEach(e => expect(conocidos.has(e) || e.includes(' + ')).toBe(true));
        expect(t.event).toBeTruthy();
      }
      expect(/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(t.timeFrame) || /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(t.timeFrame)).toBe(true);
      t.assigned.forEach(n => expect(ROSTER.map(r => r.name)).toContain(n));
      expect(t.completed).toBe(false);
    });
    Object.entries(week.schedule).forEach(([dia, d]) => d.tasks.forEach(t => { expect(ids[`${dia}${t.id}`]).toBeUndefined(); ids[`${dia}${t.id}`] = 1; }));

    const porPersona = {};
    tareas.forEach(t => {
      const [a, b] = t.timeFrame.split('-').map(x => minutos(x.trim()));
      const fin = b <= a ? b + 1440 : b;
      t.assigned.forEach(n => (porPersona[`${t.dia}|${n}`] = porPersona[`${t.dia}|${n}`] || []).push([a, fin]));
    });
    Object.values(porPersona).forEach(arr => { arr.sort((x, y) => x[0] - y[0]); for (let i = 1; i < arr.length; i++) expect(arr[i][0]).toBeGreaterThanOrEqual(arr[i - 1][1]); });
  });

  it('las reglas de equipo: Lara y Nico solo limpian; Elena y Óscar no cargan ni descargan', () => {
    tareas.forEach(t => {
      const accion = (t.text || t.details || '').toLowerCase();
      if (t.assigned.some(n => ['Lara', 'Nico'].includes(n))) expect(t.event).toBe('Limpieza Eventos');
      if (/carga de material|descarga|recogida|recoger/.test(accion) && !/supervisi|preparaci/.test(accion)) {
        expect(t.assigned.filter(n => ['Elena', 'Óscar'].includes(n))).toEqual([]);
      }
    });
  });

  it('el backup (Diego) no se carga más que los demás mientras haya otros libres', () => {
    const h = resumen.horasPorPersona;
    expect(h.Diego).toBeLessThanOrEqual(Math.max(h.Bruno, h.Carlos) + 6);
  });
});

describe('generarBorrador — casos límite', () => {
  it('las vacaciones del equipo se respetan (nadie se asigna en su rango)', () => {
    const conVacas = [...APUNTES, { id: 'v', fecha: '2026-09-22', hasta: '2026-09-27', tipo: 'vacaciones', titulo: 'Bruno' }];
    const { week } = generar(conVacas);
    expect(JSON.stringify(week)).not.toContain('"Bruno"');
  });

  it('si no alcanza la gente, asigna menos y AVISA en vez de romper', () => {
    const solo = ROSTER.filter(p => ['Bruno', 'Óscar', 'Lara'].includes(p.name));
    const { week, resumen } = generar(APUNTES, solo);
    expect(resumen.avisos.some(a => /personas libres/.test(a))).toBe(true);
    expect(validateGeneratedSchedule(week)).toBe('');
  });

  it('una semana sin eventos ni alquileres queda vacía (quien llama no crea borrador)', () => {
    const { resumen } = generar([{ id: 'x', fecha: '2026-09-23', tipo: 'tarea', titulo: 'Reunión' }]);
    expect(resumen).toMatchObject({ eventos: 0, alquileres: 0, tareas: 0 });
  });

  it('un evento sin hora ni pax usa horario propuesto y lo AVISA', () => {
    const { resumen } = generar([{ id: 'b', fecha: '2026-09-25', tipo: 'boda', titulo: 'Boda Sin Datos' }]);
    expect(resumen.avisos.some(a => /Sin Datos: el calendario no trae la hora/.test(a))).toBe(true);
    expect(resumen.avisos.some(a => /Sin Datos: sin pax/.test(a))).toBe(true);
  });

  it('un evento el domingo o el lunes va a la lista compartida con su targetDay', () => {
    const { week } = generar([{ id: 'd', fecha: '2026-09-27', tipo: 'corporativo', titulo: 'Comida Domingo', pax: 40, hora: '13:00' }]);
    expect(week.sundayMonday.tasks.length).toBeGreaterThan(0);
    week.sundayMonday.tasks.forEach(t => expect(['Domingo', 'Lunes']).toContain(t.targetDay));
  });

  it('es determinista: mismos apuntes, misma semana', () => {
    const a = generar(); const b = generar();
    expect(JSON.stringify(a.week)).toBe(JSON.stringify(b.week));
  });
});

describe('generarBorrador — correcciones vistas con el calendario real', () => {
  it('la preparación (checklist) lleva 3 personas: Elena, Óscar y apoyo', () => {
    const { week } = generar();
    const prep = week.schedule.miercoles.tasks.find(x => /Preparación y organización/.test(x.text));
    expect(prep.assigned.sort()).toEqual(['Elena', 'Rafael', 'Óscar']);
  });

  it('BUG evitado: la limpieza tras una boda de viernes NO cae de madrugada: es el domingo (el sábado hay boda)', () => {
    const { week } = generar();
    const todasLasTareas = Object.values(week.schedule).flatMap(d => d.tasks);
    expect(todasLasTareas.some(x => /Limpieza de vajilla y utensilios \(Ana/.test(x.text) && minutos(x.timeFrame.slice(0, 5)) < 6 * 60)).toBe(false);
    expect(week.sundayMonday.tasks.some(x => /^Limpieza Eventos - /.test(x.text))).toBe(true);
  });

  it('una boda de jueves por la noche se limpia el viernes por la mañana', () => {
    const { week } = generar([{ id: 'b', fecha: '2026-09-24', tipo: 'boda', titulo: 'Boda Jueves', pax: 60, sitio: 'Sala', hora: '19:00' }]);
    // jueves de noche -> el viernes por la mañana
    const viernes = week.schedule.viernes.tasks.find(x => /^Limpieza Eventos - /.test(x.text));
    expect(viernes.timeFrame).toBe('09:00 - 12:00');
  });

  it('el mismo evento apuntado en dos días se usa una sola vez y se AVISA (sin tareas duplicadas)', () => {
    const { week, resumen } = generar([
      { id: 'a', fecha: '2026-09-25', tipo: 'boda', titulo: 'Boda Eva Y Pau', pax: 29, sitio: 'Casa Uno' },
      { id: 'b', fecha: '2026-09-26', tipo: 'boda', titulo: 'Boda Eva y Pau (¿este día?)', pax: 29, sitio: 'Casa Uno' },
    ]);
    expect(resumen.eventos).toBe(1);
    expect(resumen.avisos.some(a => /aparece apuntada en dos días/.test(a))).toBe(true);
    const cargas = [...Object.values(week.schedule).flatMap(d => d.tasks)].filter(x => /Carga de material/.test(x.text));
    expect(cargas).toHaveLength(1);
    expect(week.events).toEqual([{ name: 'Boda Eva y Pau', pax: 29 }]);
  });
});

describe('generarBorrador — disponibilidad y límites de horas', () => {
  it('quien no puede un día no va ese día, y lo dicho se guarda en el borrador', () => {
    const noPuede = crearRestriccion({ persona: 'Bruno', dia: 'viernes', tipo: 'no' }).restriccion;
    const { week } = generar(APUNTES, ROSTER, { restricciones: [noPuede] });
    const viernes = todas(week).filter(t => t.dia === 'viernes');
    expect(viernes.length).toBeGreaterThan(0);
    expect(viernes.some(t => t.assigned.includes('Bruno'))).toBe(false);
    expect(week.meta.disponibilidad).toEqual([noPuede]);
  });

  it('cada tarea guarda su perfil y cuántas personas lleva (para poder reajustarla luego)', () => {
    const { week } = generar();
    const conPerfil = [...Object.values(week.schedule).flatMap(d => d.tasks), ...week.saturdaySpecial.weddings, ...week.sundayMonday.tasks];
    expect(conPerfil.every(t => t.perfil && t.personas >= 1)).toBe(true);
  });

  it('nadie pasa de 9 h en un día sin que el borrador lo avise', () => {
    const { week } = generar();
    const porDia = {};
    tareasDelPlanning(week).forEach(t => t.asignados.forEach(p => { const k = `${p}|${t.dia}`; porDia[k] = (porDia[k] || 0) + (t.fin - t.ini) / 60; }));
    Object.entries(porDia).filter(([, h]) => h > 9).forEach(([k]) => {
      expect(week.meta.avisos.some(a => a.startsWith(`${k.split('|')[0]} tiene`) && /más de 9\sh/.test(a))).toBe(true);
    });
  });
});

describe('generarBorrador — recogidas de alquiler del mismo día', () => {
  const APUNTES_RECOGIDAS = [
    { id: 'r1', fecha: '2026-09-23', tipo: 'recogida', titulo: 'recoger furgo albacar' },
    { id: 'r2', fecha: '2026-09-23', tipo: 'recogida', titulo: 'recoger generador 7k' },
  ];
  // Un conductor que solo puede desde las 15:30 entre semana (su ficha del equipo).
  const tarde = ['martes', 'miercoles', 'jueves', 'viernes'].map(dia => ({ dia, tipo: 'solo', desde: '15:30', hasta: '23:59' }));
  const ROSTER_TARDE = [{ name: 'Tomás', role: 'Conductor Extra', disponibilidad: tarde }, ...ROSTER];

  it('BUG evitado: dos recogidas a la vez van en UNA tarea con UNA persona (antes, dos tareas y dos personas)', () => {
    const { week } = generar(APUNTES_RECOGIDAS);
    const recogidas = week.schedule.miercoles.tasks.filter(t => /recoger/i.test(t.text));
    expect(recogidas).toHaveLength(1);
    expect(recogidas[0].text).toBe('Logística Preparación - recoger furgo albacar y recoger generador 7k');
    expect(recogidas[0].timeFrame).toBe('09:00 - 10:30');
    expect(recogidas[0].assigned).toHaveLength(1);
  });

  it('quien solo puede desde las 15:30 entre semana no va a una recogida de las 09:00', () => {
    const { week } = generar(APUNTES_RECOGIDAS, ROSTER_TARDE);
    const [recogida] = week.schedule.miercoles.tasks.filter(t => /recoger/i.test(t.text));
    expect(recogida.assigned).not.toContain('Tomás');
    expect(recogida.assigned).toHaveLength(1);
  });
});
