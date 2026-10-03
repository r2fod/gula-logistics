import { esTareaActiva } from './taskPlanning';
import { getWeddingTaskName } from './eventNaming';
import { tramoDeHorario } from './horarios';
import { tareasDelPlanning, revisarPlanning } from './optimizadorPlanning';
import { limitesDe, NOMBRE_DIA, restriccionesEfectivas } from './disponibilidad';

// Todas las tareas activas de la semana (con o sin horario): { dia, texto, tarea }.
function tareasActivas(semana) {
  const out = [];
  ['martes', 'miercoles', 'jueves', 'viernes'].forEach(dia => (semana?.schedule?.[dia]?.tasks || []).forEach(t => out.push({ dia, texto: t?.text, tarea: t })));
  (semana?.saturdaySpecial?.weddings || []).forEach(b => out.push({ dia: 'sabado', texto: getWeddingTaskName(b), tarea: b }));
  (semana?.sundayMonday?.tasks || []).forEach(t => out.push({ dia: /domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes', texto: t?.text, tarea: t }));
  return out.filter(x => x.tarea && typeof x.tarea === 'object' && esTareaActiva(x.tarea));
}

// Lo que conviene mirar antes de aceptar una semana (borrador → «Operativa Activa»):
// tareas sin nadie o sin horario, eventos sin pax (el coste compartido se repartiría a
// partes iguales) y lo que incumple disponibilidad, horas al día o descansos
// (revisarPlanning, la misma regla que el reparto). Lista de textos; vacía = en orden.
export function comprobarSemana(semana, equipo = []) {
  const etiqueta = (dia, texto) => `${NOMBRE_DIA[dia]}: ${String(texto || 'tarea sin nombre').trim()}`;
  const avisos = [];
  tareasDelPlanning(semana)
    .filter(t => !t.hecha && t.asignados.length === 0)
    .forEach(t => avisos.push(`${etiqueta(t.dia, t.texto)} — sin nadie asignado.`));
  tareasActivas(semana)
    .filter(x => !tramoDeHorario(x.tarea.timeFrame))
    .forEach(x => avisos.push(`${etiqueta(x.dia, x.texto)} — sin horario («HH:MM - HH:MM»).`));
  (semana?.events || [])
    .filter(e => e?.name && !(Number(e.pax) > 0))
    .forEach(e => avisos.push(`${e.name} — sin pax: su coste compartido se repartirá a partes iguales.`));
  revisarPlanning(semana, { restricciones: restriccionesEfectivas(semana, equipo), limites: limitesDe(semana) })
    .forEach(texto => avisos.push(texto));
  return avisos;
}
