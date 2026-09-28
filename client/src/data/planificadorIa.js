// El planificador con Gemini: qué se le manda, qué forma debe tener su respuesta y cómo
// se completa lo que devuelve antes de enseñarlo. Antes se le mandaba la semana entera
// (con teléfonos de contacto, enlaces de Maps y el estado de cada tarea) y la reescribía
// entera: lento, caro, con datos personales de más y con riesgo de desmarcar tareas
// hechas o de inventarse gente.
import { normalizarEtiquetaTarea, normalizeGeneratedEvents } from './eventNaming';
import { coincideNombre } from './nombresTrabajadores';
import { esTareaActiva, getDayLabel } from './taskPlanning';
import { estimarHorasPlanning } from './estimadoPlanning';
import { formatearHoras } from './formatoFinanciero';
import { tareasDeSemana } from './diffSemana';
import { enlaceMaps } from './mapas';
import { PREFIJO_ID } from './weekGenerator';

const DIAS = ['martes', 'miercoles', 'jueves', 'viernes'];
// Los de la semilla (logisticsData.js), para una semana nueva.
const CABECERAS = {
  martes: { title: 'Martes', badge: 'Preparación & Carga' },
  miercoles: { title: 'Miércoles', badge: 'Recogidas & Descarga Adelantada' },
  jueves: { title: 'Jueves', badge: 'Eventos' },
  viernes: { title: 'Viernes', badge: 'Estiba Final & Cierre' },
};
const TITULO_SABADO = 'Sábado — Eventos Simultáneos';
const TITULO_COLA = 'Domingo & Lunes — Logística Inversa y Limpieza';

const comoObjeto = (t) => (t && typeof t === 'object' ? t : { text: String(t || '') });
const lista = (x) => (Array.isArray(x) ? x : []).map(comoObjeto);
const sinVacios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
const diaDeCola = (t) => (/domingo/i.test(t?.targetDay || '') ? 'Domingo' : 'Lunes');

const tareaParaPrompt = (t, conDia = false) => sinVacios({
  id: t.id, text: t.text, location: t.location, timeFrame: t.timeFrame, assigned: t.assigned, truck: t.truck, event: t.event,
  targetDay: conDia ? diaDeCola(t) : undefined, completed: t.completed ? true : undefined,
});
const bodaParaPrompt = (b) => sinVacios({
  location: b.location, truck: b.truck, details: b.details, timeFrame: b.timeFrame, assigned: b.assigned, event: b.event, completed: b.completed ? true : undefined,
});

// La planificación tal como la ve Gemini: solo tareas activas y lo que puede cambiar.
// Sin teléfonos, enlaces de Maps ni fechas de hecha. null si no hay semana.
export function semanaParaPrompt(semana) {
  if (!semana) return null;
  const activas = (x) => lista(x).filter(esTareaActiva);
  return {
    schedule: Object.fromEntries(DIAS.map(d => [d, { tasks: activas(semana.schedule?.[d]?.tasks).map(t => tareaParaPrompt(t)) }])),
    saturdaySpecial: { weddings: activas(semana.saturdaySpecial?.weddings).map(bodaParaPrompt) },
    sundayMonday: { tasks: activas(semana.sundayMonday?.tasks).map(t => tareaParaPrompt(t, true)) },
  };
}

export const semanaVacia = (plan) => !plan || (
  DIAS.every(d => !plan.schedule[d].tasks.length) && !plan.saturdaySpecial.weddings.length && !plan.sundayMonday.tasks.length
);

// A quién puede asignar: los disponibles de la semana (o todo el equipo) y quien ya
// está asignado en ella, para no obligarle a cambiar lo que ya había.
export function nombresPermitidos({ equipo = [], disponibles = null, semana = null } = {}) {
  const base = disponibles?.length ? disponibles : equipo.map(w => w.name);
  const yaAsignados = semana ? tareasDeSemana(semana).flatMap(t => t.asignados) : [];
  return [...new Set([...base, ...yaAsignados].map(n => String(n || '').trim()).filter(Boolean))];
}

const TEXTO = { type: 'STRING' };
const ORDEN_TAREA = ['id', 'text', 'location', 'timeFrame', 'assigned', 'truck', 'event'];

// Forma obligatoria de la respuesta (responseSchema de Gemini): JSON siempre válido y
// "assigned" solo con nombres de `nombres` — ya no puede inventarse a nadie.
export function esquemaPlan(nombres = []) {
  const personas = { type: 'ARRAY', items: nombres.length ? { type: 'STRING', format: 'enum', enum: nombres } : TEXTO };
  const tarea = (conDia) => ({
    type: 'OBJECT',
    properties: {
      id: TEXTO, text: TEXTO, location: TEXTO, timeFrame: { type: 'STRING', description: 'HH:MM - HH:MM' },
      assigned: personas, truck: TEXTO, event: TEXTO,
      ...(conDia ? { targetDay: { type: 'STRING', format: 'enum', enum: ['Domingo', 'Lunes'] } } : {}),
    },
    required: ['text', 'timeFrame', 'assigned', ...(conDia ? ['targetDay'] : [])],
    propertyOrdering: [...ORDEN_TAREA, ...(conDia ? ['targetDay'] : [])],
  });
  const boda = {
    type: 'OBJECT',
    properties: { location: TEXTO, truck: TEXTO, details: TEXTO, timeFrame: TEXTO, assigned: personas, event: TEXTO },
    required: ['location', 'timeFrame', 'assigned'],
    propertyOrdering: ['location', 'truck', 'details', 'timeFrame', 'assigned', 'event'],
  };
  const dia = { type: 'OBJECT', properties: { tasks: { type: 'ARRAY', items: tarea(false) } }, required: ['tasks'] };
  return {
    type: 'OBJECT',
    properties: {
      schedule: { type: 'OBJECT', properties: Object.fromEntries(DIAS.map(d => [d, dia])), required: DIAS, propertyOrdering: DIAS },
      saturdaySpecial: { type: 'OBJECT', properties: { weddings: { type: 'ARRAY', items: boda } }, required: ['weddings'] },
      sundayMonday: { type: 'OBJECT', properties: { tasks: { type: 'ARRAY', items: tarea(true) } }, required: ['tasks'] },
    },
    required: ['schedule', 'saturdaySpecial', 'sundayMonday'],
    propertyOrdering: ['schedule', 'saturdaySpecial', 'sundayMonday'],
  };
}

// "9:00-11:30", "09.00 a 11.30" → "09:00 - 11:30". Lo que no se entiende se deja tal cual.
export function normalizarHorario(horario) {
  const texto = String(horario || '').trim();
  const m = /^(\d{1,2})[:.h](\d{2})\s*(?:-|–|—|a)\s*(\d{1,2})[:.h](\d{2})$/i.exec(texto);
  if (!m) return texto;
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(m[1])}:${m[2]} - ${dos(m[3])}:${m[4]}`;
}

// Empareja cada tarea que devuelve Gemini con la que había (primero por id y, si no,
// por `clave`), sin usar dos veces la misma. `restantes()`: las que nadie reclamó.
function emparejador(previas, clave) {
  const libres = [...previas];
  const buscar = (t) => {
    let i = t.id ? libres.findIndex(p => p.id === t.id) : -1;
    if (i === -1) {
      const k = clave(t);
      i = k ? libres.findIndex(p => clave(p) === k) : -1;
    }
    return i === -1 ? null : libres.splice(i, 1)[0];
  };
  buscar.restantes = () => libres;
  return buscar;
}

// Una tarea propuesta, completada con lo que Gemini no ve de la que había (teléfono…),
// nombres exactos del equipo, horario normalizado y enlace de Maps de su lugar.
function completarTarea(t, previa, nombreExacto) {
  const tarea = { ...(previa || {}), ...t };
  tarea.assigned = [...new Set((Array.isArray(t.assigned) ? t.assigned : []).map(nombreExacto).filter(Boolean))];
  tarea.timeFrame = normalizarHorario(t.timeFrame ?? previa?.timeFrame);
  tarea.location = String(t.location ?? previa?.location ?? '').trim();
  tarea.mapsUrl = previa?.mapsUrl && String(previa.location || '').trim() === tarea.location ? previa.mapsUrl : enlaceMaps(tarea.location);
  tarea.completed = false;
  delete tarea.completedAt;
  delete tarea.reopened;
  return tarea;
}

// Ids cortos por día (m1, mi2, sl3…): las que ya existían conservan el suyo; las nuevas
// o con un id repetido reciben el siguiente libre.
function conIds(entradas, prefijo) {
  const propios = new Map();
  entradas.forEach(({ tarea, previa }) => { if (previa?.id && tarea.id === previa.id) propios.set(previa.id, tarea); });
  const usados = new Set(propios.keys());
  let n = 0;
  const libre = () => { let id; do { n += 1; id = `${prefijo}${n}`; } while (usados.has(id)); usados.add(id); return id; };
  return entradas.map(({ tarea }) => {
    if (tarea.id && propios.get(tarea.id) === tarea) return tarea;
    if (tarea.id && !usados.has(tarea.id)) { usados.add(tarea.id); return tarea; }
    return { ...tarea, id: libre() };
  });
}

// Lo que devuelve Gemini (solo la planificación) convertido en una planificación completa
// y segura de aplicar sobre `original` (null en una semana nueva):
//   · las tareas HECHAS no cambian ni desaparecen, diga lo que diga Gemini;
//   · las desactivadas (que no ve) se conservan tal cual;
//   · se conserva lo que no ve de cada tarea (teléfono…) y se rehace el enlace de Maps;
//   · nombres exactos del equipo, horarios "HH:MM - HH:MM", ids únicos por día.
export function completarPlanGenerado(generado, { original = null, equipo = [], eventNames = [] } = {}) {
  const plan = normalizeGeneratedEvents(generado || {}, eventNames);
  const nombreExacto = (n) => { const s = String(n || '').trim(); return equipo.find(w => coincideNombre(w.name, s))?.name || s; };
  const porTexto = (t) => normalizarEtiquetaTarea(t?.text || '');
  const porLugar = (b) => normalizarEtiquetaTarea(b?.location || '');

  const completarLista = (nuevas, previas, clave, prefijo = null, ajustar = (t) => t) => {
    const emparejar = emparejador(previas.filter(esTareaActiva), clave);
    const entradas = lista(nuevas).map(t => {
      const previa = emparejar(t);
      if (previa?.completed) return { tarea: previa, previa };
      return { tarea: ajustar(completarTarea(t, previa, nombreExacto)), previa };
    });
    // Hechas que Gemini no devolvió y desactivadas: se quedan como estaban.
    const intocables = [...emparejar.restantes().filter(p => p.completed), ...previas.filter(p => !esTareaActiva(p))];
    const todas = [...entradas, ...intocables.map(p => ({ tarea: p, previa: p }))];
    return prefijo ? conIds(todas, prefijo) : todas.map(e => e.tarea);
  };

  const schedule = Object.fromEntries(DIAS.map(d => {
    const antes = original?.schedule?.[d] || {};
    return [d, {
      ...antes,
      title: antes.title || CABECERAS[d].title,
      badge: antes.badge || CABECERAS[d].badge,
      tasks: completarLista(plan.schedule?.[d]?.tasks, lista(antes.tasks), porTexto, PREFIJO_ID[d]),
    }];
  }));

  return {
    schedule,
    saturdaySpecial: {
      ...(original?.saturdaySpecial || {}),
      title: original?.saturdaySpecial?.title || TITULO_SABADO,
      weddings: completarLista(plan.saturdaySpecial?.weddings, lista(original?.saturdaySpecial?.weddings), porLugar),
    },
    sundayMonday: {
      ...(original?.sundayMonday || {}),
      title: original?.sundayMonday?.title || TITULO_COLA,
      tasks: completarLista(plan.sundayMonday?.tasks, lista(original?.sundayMonday?.tasks), porTexto, PREFIJO_ID.domingo, (t) => ({ ...t, targetDay: diaDeCola(t) })),
    },
  };
}

// Lo que Gemini necesita saber de la semana además de sus tareas, en pocas líneas.
export function contextoParaPrompt({ semana = null, equipo = [], disponibles = null } = {}) {
  const lineas = [];
  if (semana?.meta?.dateRange) {
    const dias = [...DIAS, 'sabado', 'domingo', 'lunes'].map(d => getDayLabel(semana, d));
    lineas.push(`SEMANA: ${semana.meta.dateRange}. Días: ${dias.join(', ')} (el lunes es la cola: devoluciones, limpieza y cargas).`);
  }
  const libres = disponibles?.length ? equipo.filter(w => disponibles.some(n => coincideNombre(n, w.name))) : equipo;
  if (libres.length) lineas.push(`EQUIPO DISPONIBLE (usa EXACTAMENTE estos nombres en "assigned"):\n${libres.map(w => `- ${w.name}${w.role ? ` — ${w.role}` : ''}`).join('\n')}`);
  const fuera = disponibles?.length ? equipo.filter(w => !libres.includes(w)).map(w => w.name) : [];
  if (fuera.length) lineas.push(`NO DISPONIBLES esta semana (no los asignes): ${fuera.join(', ')}.`);
  const camiones = (semana?.trucks || []).map(t => t?.name).filter(Boolean);
  if (camiones.length) lineas.push(`CAMIONES de la semana: ${camiones.join(', ')}.`);
  const eventos = (semana?.events || []).filter(e => e?.name).map(e => `${e.name}${Number(e.pax) > 0 ? ` (${e.pax} pax)` : ''}`);
  if (eventos.length) lineas.push(`EVENTOS de la semana: ${eventos.join(', ')}.`);
  const carga = semana ? estimarHorasPlanning(semana, equipo).porPersona.filter(p => p.horas > 0) : [];
  if (carga.length) lineas.push(`HORAS YA PLANIFICADAS por persona (para repartir la carga): ${carga.map(p => `${p.nombre} ${formatearHoras(p.horas)}`).join(', ')}.`);
  return lineas.join('\n');
}

// Pedirle que arregle lo que avisosDeSemana encontró en su propuesta.
export const promptCorreccion = (avisos = []) => `Corrige SOLO estos problemas de la planificación, sin cambiar nada más:\n${avisos.map(a => `- ${a}`).join('\n')}`;
