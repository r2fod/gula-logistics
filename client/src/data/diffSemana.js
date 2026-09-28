import { getWeddingTaskName, normalizarEtiquetaTarea } from './eventNaming';
import { esTareaActiva } from './taskPlanning';
import { plano } from '../utils/texto';
import { tramoDeHorario } from './horarios';
import { revisarPlanning } from './optimizadorPlanning';
import { limitesDe, restriccionesDelEquipo, restriccionesEfectivas } from './disponibilidad';

// Qué cambia entre la semana actual y la que propone Gemini, y qué hay que
// revisar antes de aplicarla (CLAUDE.md: la IA puede inventar asignaciones o
// camiones). Antes la vista previa del asistente solo enseñaba las bodas del sábado.

const DIAS = [
  ['martes', 'Martes'], ['miercoles', 'Miércoles'], ['jueves', 'Jueves'], ['viernes', 'Viernes'],
  ['sabado', 'Sábado'], ['domingo', 'Domingo'], ['lunes', 'Lunes'],
];

// Todas las tareas activas de una semana con su día real: [{ dia, id, texto, horario, asignados }].
export function tareasDeSemana(semana) {
  if (!semana) return [];
  const tareas = [];
  const anadir = (dia, t, texto) => {
    if (!t || !esTareaActiva(t)) return;
    tareas.push({ dia, id: t.id || null, texto: String(texto || '').trim(), horario: t.timeFrame || '', asignados: Array.isArray(t.assigned) ? t.assigned : [] });
  };
  Object.entries(semana.schedule || {}).forEach(([dia, d]) => (d?.tasks || []).forEach(t => anadir(dia, t, typeof t === 'object' ? t.text : t)));
  (semana.saturdaySpecial?.weddings || []).forEach(b => anadir('sabado', b, getWeddingTaskName(b)));
  (semana.sundayMonday?.tasks || []).forEach(t => anadir(/domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes', t, t?.text));
  return tareas;
}

const clave = (t) => (t.id ? `id:${t.id}` : `txt:${normalizarEtiquetaTarea(t.texto)}`);

// { porDia: [{ dia, etiqueta, nuevas, quitadas, cambiadas: [{ texto, cambios }] }], resumen }
export function diffSemana(actual, propuesta) {
  const antes = tareasDeSemana(actual);
  const despues = tareasDeSemana(propuesta);
  const porDia = DIAS.map(([dia, etiqueta]) => {
    const a = antes.filter(t => t.dia === dia);
    const d = despues.filter(t => t.dia === dia);
    const mapaA = new Map(a.map(t => [clave(t), t]));
    const mapaD = new Map(d.map(t => [clave(t), t]));
    // Una tarea con id en un lado y sin id en el otro se empareja por el texto.
    const buscar = (mapa, t) => mapa.get(clave(t)) || mapa.get(`txt:${normalizarEtiquetaTarea(t.texto)}`)
      || [...mapa.values()].find(o => normalizarEtiquetaTarea(o.texto) === normalizarEtiquetaTarea(t.texto));
    const nuevas = d.filter(t => !buscar(mapaA, t)).map(t => t.texto);
    const quitadas = a.filter(t => !buscar(mapaD, t)).map(t => t.texto);
    const cambiadas = d.map(t => {
      const previa = buscar(mapaA, t);
      if (!previa) return null;
      const cambios = [];
      if (previa.texto !== t.texto) cambios.push(`texto: «${previa.texto}» → «${t.texto}»`);
      if ((previa.horario || '') !== (t.horario || '')) cambios.push(`horario: ${previa.horario || 'sin hora'} → ${t.horario || 'sin hora'}`);
      const entran = t.asignados.filter(n => !previa.asignados.includes(n));
      const salen = previa.asignados.filter(n => !t.asignados.includes(n));
      if (entran.length) cambios.push(`entra ${entran.join(', ')}`);
      if (salen.length) cambios.push(`sale ${salen.join(', ')}`);
      return cambios.length ? { texto: t.texto, cambios } : null;
    }).filter(Boolean);
    return { dia, etiqueta, nuevas, quitadas, cambiadas };
  }).filter(d => d.nuevas.length || d.quitadas.length || d.cambiadas.length);

  const resumen = porDia.reduce((r, d) => ({
    nuevas: r.nuevas + d.nuevas.length, quitadas: r.quitadas + d.quitadas.length, cambiadas: r.cambiadas + d.cambiadas.length,
  }), { nuevas: 0, quitadas: 0, cambiadas: 0 });
  return { porDia, resumen };
}

const sinParentesis = (s) => plano(s).replace(/\(.*?\)/g, '').trim();

// Lo que conviene revisar en la semana propuesta: gente que no está en el equipo,
// camiones que no están en la flota y personas con dos tareas a la vez el mismo día.
export function avisosDeSemana(semana, { equipo = [], camiones = [] } = {}) {
  const avisos = [];
  const tareas = tareasDeSemana(semana);
  const nombres = new Set(equipo.map(w => plano(w.name)));

  const desconocidos = [...new Set(tareas.flatMap(t => t.asignados).filter(n => nombres.size && !nombres.has(plano(n))))];
  if (desconocidos.length) avisos.push(`Asigna a quien no está en el equipo: ${desconocidos.join(', ')}.`);

  // Un camión de boda es conocido si nombra alguno de la flota ("Camión Norte (Propio)"
  // vale para "Camión Norte"); una boda puede llevar dos ("Camión A + Camión B").
  const flota = [...camiones, ...(semana?.trucks || []).map(t => t?.name)].filter(Boolean).map(sinParentesis);
  if (flota.length) {
    const raros = [...new Set((semana?.saturdaySpecial?.weddings || []).filter(esTareaActiva)
      .flatMap(b => String(b.truck || '').split(/\s*\+\s*/)).map(c => c.trim()).filter(Boolean)
      .filter(c => !flota.some(f => sinParentesis(c).includes(f) || f.includes(sinParentesis(c)))))];
    if (raros.length) avisos.push(`Usa camiones que no están en la flota: ${raros.join(', ')}.`);
  }

  // Solapes: la misma persona en dos tareas del mismo día con horarios que se pisan.
  const solapes = new Set();
  const porPersonaYDia = new Map();
  tareas.forEach(t => {
    const r = tramoDeHorario(t.horario);
    if (!r) return;
    t.asignados.forEach(n => {
      const k = `${n}|${t.dia}`;
      (porPersonaYDia.get(k) || porPersonaYDia.set(k, []).get(k)).push({ ...r, texto: t.texto });
    });
  });
  porPersonaYDia.forEach((lista, k) => {
    const [nombre, dia] = k.split('|');
    const orden = [...lista].sort((a, b) => a.ini - b.ini);
    for (let i = 1; i < orden.length; i++) {
      if (orden[i].ini < orden[i - 1].fin) solapes.add(`${nombre} (${dia}): «${orden[i - 1].texto}» y «${orden[i].texto}»`);
    }
  });
  if (solapes.size) avisos.push(`Personas con dos tareas a la vez: ${[...solapes].join('; ')}.`);

  return avisos;
}

// Los avisos NUEVOS de una propuesta (de Gemini, del reajuste…) sobre la semana
// `actual`: gente o camiones que no existen, solapes y lo que incumple la
// disponibilidad o los límites de horas. Lo que ya pasaba antes no se repite.
// `restricciones`: las de la propuesta si trae otras (null = las de la semana).
export function avisosDePropuesta({ actual = null, propuesta, equipo = [], camiones = [], restricciones = null, extra = [] }) {
  const limites = limitesDe(actual);
  const antes = restriccionesEfectivas(actual, equipo);
  const previos = new Set(actual ? revisarPlanning(actual, { restricciones: antes, limites }) : []);
  const nuevos = [
    ...revisarPlanning({ ...(actual || {}), ...propuesta }, { restricciones: restricciones ? [...restriccionesDelEquipo(equipo), ...restricciones] : antes, limites }),
    ...extra,
  ].filter(a => !previos.has(a));
  return [...new Set([...avisosDeSemana(propuesta, { equipo, camiones }), ...nuevos])];
}
