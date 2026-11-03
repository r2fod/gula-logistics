// Modelo del PDF del planning de una semana (puro: sin jsPDF, sin red).
// `pdfPlanningDoc.js` lo dibuja; aquí solo se decide QUÉ sale y en qué orden.
import { DIAS_SEMANA } from './disponibilidad';
import { getDayLabel, esTareaActiva } from './taskPlanning';
import { tramoDeHorario } from './horarios';
import { parseEventAndTask, EVENT_CATEGORIES, GENERAL_EVENT } from './eventNaming';
import { mismoNombre } from './nombresTrabajadores';
import { plano } from '../utils/texto';

const texto = (v) => String(v ?? '').trim();

// Una tarea de las listas normales (martes→viernes, domingo/lunes).
function filaDeTarea(t) {
  const { eventName, specificTaskName, explicit } = parseEventAndTask(t.text);
  const sinEvento = !explicit && (specificTaskName === 'Tarea General' || EVENT_CATEGORIES.includes(eventName) || eventName === GENERAL_EVENT);
  return { evento: sinEvento ? '' : eventName, tarea: sinEvento ? texto(t.text) : specificTaskName };
}

// Una boda del sábado: el evento sale de `event` o de `details` antes de « — ».
function filaDeBoda(b) {
  const detalle = texto(b.details);
  const [antes, ...resto] = detalle.split(/\s+[—–]\s+/);
  const hayRaya = resto.length > 0;
  const evento = texto(b.event) || (hayRaya ? antes : '') || (texto(b.location) ? `Boda ${texto(b.location)}` : 'Boda');
  const tarea = hayRaya ? resto.join(' — ') : detalle || 'Boda';
  return { evento, tarea };
}

function tareaDelModelo(t, { evento, tarea }) {
  return {
    hora: texto(t.timeFrame), evento, tarea,
    equipo: (Array.isArray(t.assigned) ? t.assigned : []).map(texto).filter(Boolean),
    vehiculo: texto(t.truck), lugar: texto(t.location), hecha: !!t.completed,
  };
}

// Las tareas activas de un día, por hora de inicio (las que no tienen hora, al final).
const ordenadas = (lista) => lista
  .map((t, i) => ({ t, i, ini: tramoDeHorario(t.timeFrame)?.ini ?? Infinity }))
  .sort((a, b) => (a.ini === b.ini ? a.i - b.i : a.ini - b.ini))
  .map((x) => x.t);

const activas = (lista) => (lista || []).filter((t) => t && typeof t === 'object' && esTareaActiva(t));

// → { cabecera, eventos, dias: [{ clave, titulo, tareas }], resumen, sinAsignar, totalTareas }
export function datosDelPdf(semana, equipo = []) {
  const meta = semana?.meta || {};
  const cola = activas(semana?.sundayMonday?.tasks);
  const listas = {
    martes: activas(semana?.schedule?.martes?.tasks),
    miercoles: activas(semana?.schedule?.miercoles?.tasks),
    jueves: activas(semana?.schedule?.jueves?.tasks),
    viernes: activas(semana?.schedule?.viernes?.tasks),
    sabado: activas(semana?.saturdaySpecial?.weddings),
    domingo: cola.filter((t) => /domingo/i.test(t.targetDay || '')),
    lunes: cola.filter((t) => !/domingo/i.test(t.targetDay || '')),
  };

  // Cada día con sus tareas crudas (para las horas) y las del modelo, en el mismo orden.
  const dias = DIAS_SEMANA.map((clave) => {
    const crudas = ordenadas(listas[clave]);
    const tareas = crudas.map((t) => tareaDelModelo(t, clave === 'sabado' ? filaDeBoda(t) : filaDeTarea(t)));
    return { clave, titulo: getDayLabel(semana, clave), tareas, crudas };
  }).filter((d) => d.tareas.length);

  // Eventos sin repetir (sin tildes ni mayúsculas).
  const vistos = new Set();
  const eventos = [];
  (semana?.events || []).forEach((ev) => {
    const nombre = texto(ev?.name);
    if (!nombre || vistos.has(plano(nombre))) return;
    vistos.add(plano(nombre));
    eventos.push({ nombre, pax: Number(ev.pax) > 0 ? Number(ev.pax) : null });
  });

  // Resumen por persona (con el nombre del equipo si coincide) y tareas sin nadie.
  const personas = [];
  const sinAsignar = [];
  dias.forEach((d) => d.crudas.forEach((t, i) => {
    const fila = d.tareas[i];
    if (!fila.equipo.length) sinAsignar.push({ dia: d.titulo, hora: fila.hora, texto: [fila.evento, fila.tarea].filter(Boolean).join(' - ') });
    const tramo = tramoDeHorario(t.timeFrame);
    const minutos = tramo ? tramo.fin - tramo.ini : 0;
    const contadas = [];
    fila.equipo.forEach((nombre) => {
      if (contadas.some((c) => mismoNombre(c, nombre))) return; // repetido en la misma tarea
      contadas.push(nombre);
      let p = personas.find((x) => mismoNombre(x.nombre, nombre));
      if (!p) {
        p = { nombre: equipo.find((e) => mismoNombre(e?.name, nombre))?.name || nombre, tareas: 0, minutos: 0 };
        personas.push(p);
      }
      p.tareas += 1;
      p.minutos += minutos;
    });
  }));

  const resumen = personas
    .map(({ nombre, tareas, minutos }) => ({ nombre, tareas, horas: Math.round((minutos / 60) * 100) / 100 }))
    .sort((a, b) => b.horas - a.horas || b.tareas - a.tareas || a.nombre.localeCompare(b.nombre, 'es'));

  return {
    cabecera: { semana: texto(meta.week) || 'Semana', rango: texto(meta.dateRange), estado: texto(meta.status) },
    eventos,
    dias: dias.map(({ clave, titulo, tareas }) => ({ clave, titulo, tareas })),
    resumen,
    sinAsignar,
    totalTareas: dias.reduce((n, d) => n + d.tareas.length, 0),
  };
}

// «Planning <semana> (<rango>).pdf», sin caracteres que un sistema de archivos no admita.
export function nombreDelPdf(semana) {
  const limpio = (s) => texto(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const nombre = limpio(semana?.meta?.week) || 'Semana';
  const rango = limpio(semana?.meta?.dateRange);
  return `Planning ${nombre}${rango ? ` (${rango})` : ''}.pdf`;
}
