import { construirGrafoMemoria, vecinosDe } from './grafoMemoria';
import { esBorradorSemana, parseEventAndTask } from './eventNaming';
import { esTareaActiva } from './taskPlanning';
import { personaDelFichaje } from './nombresTrabajadores';
import { plano } from '../utils/texto';

// Lo que el asistente aprende SOLO del planning de las semanas ya aceptadas (sin que
// nadie escriba nada; crece cada semana):
//   · camiones: con quién va cada uno (del grafo de Memoria IA, el mismo que ve el admin);
//   · recurrentes: las tareas que se repiten semana a semana (recoger el generador,
//     devolver la furgo…) y quién las hace.
// Va dentro de `aprendizaje.planning` (App) y llega a Gemini en todos los caminos
// (textoAprendizajeParaPrompt) y a las respuestas sin Gemini (respuestaDeConocimiento).

const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'y', 'e', 'a', 'al', 'en', 'con', 'para', 'por', 'se', 'lo', 'todo', 'toda', 'material', 'camion', 'furgo', 'furgoneta']);
const raiz = (w) => w.slice(0, 6); // generadores y generador → «genera»

// Clave de una tarea para reconocerla en otras semanas aunque se escriba distinto:
// «Boda X - Recoger camión Albacar» y «Logística - recoger furgo albacar» → «recog albac».
export function claveDeTarea(texto) {
  const { specificTaskName, explicit } = parseEventAndTask(texto);
  const palabras = plano(explicit ? specificTaskName : texto).split(/[^a-z0-9]+/).filter(w => w && !VACIAS.has(w));
  return palabras.slice(0, 3).map(raiz).join(' ');
}

const ordenar = (mapa) => [...mapa].map(([nombre, veces]) => ({ nombre, veces })).sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'));

export function aprenderDelPlanning(semanas = {}, equipo = []) {
  const delEquipo = (n) => !equipo.length || !!personaDelFichaje(equipo, n, w => w.name);

  // Camiones: los vecinos de cada camión en el grafo (veces que van juntos).
  const grafo = construirGrafoMemoria({ equipo, semanas });
  const camiones = grafo.nodos.filter(n => n.tipo === 'camion').map(n => ({
    camion: n.etiqueta,
    personas: ordenar(new Map(vecinosDe(grafo, n.id).filter(v => v.nodo.tipo === 'persona' && delEquipo(v.nodo.etiqueta)).map(v => [v.nodo.etiqueta, v.peso]))),
  })).filter(c => c.personas.length).sort((a, b) => b.personas[0].veces - a.personas[0].veces);

  // Tareas que se repiten (en 2 semanas o más) y quién las hace.
  const porClave = new Map();
  Object.entries(semanas || {}).filter(([, s]) => s && !esBorradorSemana(s)).forEach(([id, s]) => {
    [...Object.values(s.schedule || {}).map(d => d?.tasks), s.sundayMonday?.tasks].forEach(lista => (lista || []).forEach(t => {
      if (!t || typeof t !== 'object' || !esTareaActiva(t) || !t.text) return;
      const clave = claveDeTarea(t.text);
      if (!clave) return;
      const e = porClave.get(clave) || { semanas: new Set(), personas: new Map(), etiqueta: '' };
      e.semanas.add(id);
      e.etiqueta = parseEventAndTask(t.text).explicit ? parseEventAndTask(t.text).specificTaskName : t.text;
      (t.assigned || []).filter(delEquipo).forEach(n => e.personas.set(n, (e.personas.get(n) || 0) + 1));
      porClave.set(clave, e);
    }));
  });
  const recurrentes = [...porClave].filter(([, e]) => e.semanas.size >= 2 && e.personas.size)
    .map(([clave, e]) => ({ clave, tarea: e.etiqueta.trim(), semanas: e.semanas.size, personas: ordenar(e.personas) }))
    .sort((a, b) => b.semanas - a.semanas);

  return { camiones, recurrentes };
}
