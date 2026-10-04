import { revisarFichajes } from './revisionFichajes';
import { tareasActivas } from './checklistSemana';
import { coincideNombre } from './nombresTrabajadores';
import { NOMBRE_DIA } from './disponibilidad';

// Estado de la base de datos para «Configuración → Base de datos»: lo que se puede
// limpiar (papelera, fichajes que sobran), lo que hay que revisar (turnos muy largos) y
// lo «huérfano» (datos que apuntan a alguien que ya no está en el equipo). La
// optimización de la base (índices, espacio) la hace MongoDB Atlas sola.
// `fichajes` son los activos; `borrados`, los de la papelera; `fichas`, las de Saldos.
export function revisarBaseDeDatos({ fichajes = [], borrados = [], equipo = [], semanas = {}, fichas = [], ahora = new Date() } = {}) {
  const { sobran, revisar } = revisarFichajes(fichajes, ahora);
  const enEquipo = (nombre) => equipo.some(w => coincideNombre(w.name, nombre));
  const conEquipo = equipo.length > 0; // sin equipo cargado no se puede decir qué es huérfano

  const fichajesSinPersona = conEquipo
    ? [...new Set(fichajes.filter(e => e.workerName && !enEquipo(e.workerName)).map(e => e.workerName))].sort((a, b) => a.localeCompare(b, 'es'))
    : [];
  const tareasSinPersona = conEquipo
    ? Object.values(semanas || {}).flatMap(s => tareasActivas(s).flatMap(x => (x.tarea.assigned || [])
      .filter(n => !enEquipo(n))
      .map(nombre => ({ semana: s?.meta?.week || s?.meta?.dateRange || '', dia: NOMBRE_DIA[x.dia], tarea: String(x.texto || '').trim(), nombre }))))
    : [];
  // Sin fichas cargadas (sesión caducada, aún llegando) no se sabe: no se avisa de nada.
  const conFichas = conEquipo && fichas.length > 0;
  const fichasSinPersona = conFichas ? fichas.filter(f => f?.name && !enEquipo(f.name)).map(f => f.name) : [];
  const personasSinFicha = conFichas ? equipo.filter(w => !fichas.some(f => coincideNombre(w.name, f?.name))).map(w => w.name) : [];

  const idsQueSobran = sobran.flatMap(g => g.fichajes.map(e => e.id));
  const pendientes = (borrados.length ? 1 : 0) + (idsQueSobran.length ? 1 : 0) + (revisar.length ? 1 : 0)
    + (fichajesSinPersona.length ? 1 : 0) + (tareasSinPersona.length ? 1 : 0) + (fichasSinPersona.length ? 1 : 0) + (personasSinFicha.length ? 1 : 0);
  return { papelera: borrados.length, idsQueSobran, turnosLargos: revisar.length, fichajesSinPersona, tareasSinPersona, fichasSinPersona, personasSinFicha, pendientes };
}
