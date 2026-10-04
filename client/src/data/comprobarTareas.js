import { plano } from '../utils/texto';
import { getDayLabel } from './taskPlanning';
import { tareasActivas } from './checklistSemana';
import { tipoDeTarea, personasPorTipo } from './aprendizajeFichajes';
import { coincideNombre } from './nombresTrabajadores';

// «¿Hay en el planning recoger furgo Albacar y recoger generador 7K? Si no está,
// añádelo»: se comprueba aquí, sin gastar Gemini, y solo lo que falte se le pide.
// Antes la frase iba entera a Gemini y, por «GENERAdor», se rehacía la semana entera.

// Verbos de tarea y la raíz con que aparecen en los textos del planning.
const VERBOS = {
  recoger: /recog/, recogida: /recog/, devolver: /devol/, devolucion: /devol/, llevar: /llev/, traer: /tra[ei]/,
  cargar: /\bcarg/, carga: /\bcarg/, descargar: /descarg/, descarga: /descarg/, montar: /mont/, desmontar: /desmont/,
  limpiar: /limpi/, preparar: /prepar/,
};
// Palabras que no distinguen una tarea de otra («furgo» y «camión» Albacar son lo mismo).
const GENERICAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'al', 'furgo', 'furgoneta', 'camion', 'material', 'todo', 'toda']);
// Donde acaba lo que hay que hacer: «… y si no está», «asignando…».
const CORTE = new Set(['y', 'e', 'si', 'para', 'asignando', 'preguntandote', 'usando', 'a', 'que', 'con', 'en', 'por', 'sin', 'o']);
const raiz = (palabra) => (palabra.length > 5 ? palabra.slice(0, -2) : palabra); // generadores ⊃ generad

// Las tareas que nombra un texto ya pasado por `plano`: «recoger furgo albacar y recoger
// generador 7k» → [{ texto, verbo, claves }].
function itemsDeTexto(p) {
  const palabras = p.split(/[^a-z0-9]+/).filter(Boolean);
  const items = [];
  palabras.forEach((palabra, i) => {
    if (!VERBOS[palabra]) return;
    const objeto = [];
    for (let j = i + 1; j < palabras.length && objeto.length < 5 && !VERBOS[palabras[j]] && !CORTE.has(palabras[j]); j++) objeto.push(palabras[j]);
    const claves = objeto.filter(x => !GENERICAS.has(x));
    if (claves.length) items.push({ texto: `${palabra} ${objeto.join(' ')}`, verbo: palabra, claves });
  });
  return items;
}

// ¿Pide comprobar si hay ciertas tareas? → { items: [{ texto, verbo, claves }], anadir } o null.
export function pideComprobarTareas(peticion) {
  const p = plano(peticion);
  const comprueba = /\b(hay|existe|existen|esta|estan|consulta|comprueba|mira|revisa|busca)\b/.test(p)
    && /\b(planning|planificacion|semana|cuadrante)\b|\bsi no (esta|estan|hay|existe)/.test(p);
  if (!comprueba) return null;
  const items = itemsDeTexto(p);
  if (!items.length) return null;
  return { items, anadir: /\b(si no|anade|anadelo|anadela|anadelas|agrega|agregalo|agregala|agregalas|pon|ponlo|ponla|crea|crealo|incluye|incluyelo)\b/.test(p) };
}

// ¿Es esta tarea (texto del planning) la que se pide? Mismo verbo y todas sus palabras clave.
export const coincideConTarea = (texto, item) => {
  const t = plano(texto);
  return VERBOS[item.verbo].test(t) && item.claves.every(c => t.includes(raiz(c)));
};

// Las tareas de la semana que ya son eso: [{ dia, etiqueta, texto, horario, personas }].
export function buscarEnSemana(semana, item) {
  return tareasActivas(semana)
    .filter(x => coincideConTarea(x.texto, item))
    .map(x => ({ dia: x.dia, etiqueta: getDayLabel(semana, x.dia), texto: String(x.texto || '').trim(), horario: x.tarea.timeFrame || '', personas: x.tarea.assigned || [] }));
}

// Quién la suele hacer: quién la tuvo en otras semanas (por el planning) y, si nunca
// se hizo, quién hace más horas de ese tipo según los fichajes. Solo gente del equipo.
// → { lista: [{ nombre, veces? , horas? }], fuente: 'planning' | 'fichajes' }
export function quienSueleHacerla(item, { semanas = {}, aprendizaje = null, equipo = [] } = {}) {
  const delEquipo = (nombre) => !equipo.length || equipo.some(w => coincideNombre(w.name, nombre));
  const veces = new Map();
  Object.values(semanas || {}).forEach(s => tareasActivas(s)
    .filter(x => coincideConTarea(x.texto, item))
    .forEach(x => (x.tarea.assigned || []).filter(delEquipo).forEach(n => veces.set(n, (veces.get(n) || 0) + 1))));
  const porPlanning = [...veces].map(([nombre, n]) => ({ nombre, veces: n })).sort((a, b) => b.veces - a.veces);
  if (porPlanning.length) return { lista: porPlanning, fuente: 'planning' };
  const porTipo = personasPorTipo(aprendizaje?.porPersona)[tipoDeTarea(item.texto)] || [];
  return { lista: porTipo.filter(p => delEquipo(p.nombre)), fuente: 'fichajes' };
}

const textoSuelen = ({ lista, fuente }) => (lista.length
  ? `suelen hacerla ${lista.slice(0, 3).map(p => (fuente === 'planning' ? `${p.nombre} (${p.veces} ${p.veces === 1 ? 'vez' : 'veces'})` : `${p.nombre} (${p.horas} h)`)).join(', ')}`
  : 'nadie la ha hecho aún');

// Lo que se contesta: qué está ya (dónde y con quién) y qué falta (y quién la suele hacer).
export function textoComprobacion(resultados) {
  const lineas = resultados.map(({ item, encontradas, suelen }) => (encontradas.length
    ? `✅ «${item.texto}» ya está: ${encontradas.map(e => `${e.etiqueta}, ${e.horario || 'sin horario'} — «${e.texto}»${e.personas.length ? ` (${e.personas.join(', ')})` : ' (sin nadie asignado)'}`).join('; ')}.`
    : `➕ «${item.texto}» no está en esta semana; ${textoSuelen(suelen)}.`));
  return lineas.join('\n');
}

// Tareas de la propuesta que no estaban antes (por id; el sábado, por texto):
// [{ lista: 'martes'…'cola'|'sabado', clave, texto, personas }].
export function tareasNuevas(original, propuesta) {
  const ids = new Set(tareasActivas(original).map(x => x.tarea.id).filter(Boolean));
  const textosSabado = new Set((original?.saturdaySpecial?.weddings || []).map(b => plano(b?.details)));
  return tareasActivas(propuesta)
    .filter(x => (x.dia === 'sabado' ? !textosSabado.has(plano(x.tarea.details)) : !ids.has(x.tarea.id)))
    .map(x => ({ dia: x.dia, clave: x.tarea.id || x.tarea.details, texto: String(x.texto || '').trim(), personas: x.tarea.assigned || [] }));
}

// Cambia quién hace una tarea nueva de la propuesta (por su `clave`), sin tocar nada más.
export function asignarEnPropuesta(propuesta, clave, personas) {
  const cambiar = (t) => ((t?.id || t?.details) === clave ? { ...t, assigned: personas } : t);
  return {
    ...propuesta,
    schedule: Object.fromEntries(Object.entries(propuesta.schedule || {}).map(([d, x]) => [d, { ...x, tasks: (x?.tasks || []).map(cambiar) }])),
    saturdaySpecial: { ...propuesta.saturdaySpecial, weddings: (propuesta.saturdaySpecial?.weddings || []).map(cambiar) },
    sundayMonday: { ...propuesta.sundayMonday, tasks: (propuesta.sundayMonday?.tasks || []).map(cambiar) },
  };
}

// Tipos de tarea por cómo se nombran en una pregunta («¿quién suele hacer las cargas?»).
const TIPOS_EN_PREGUNTA = [
  [/\bdescarg|\bmontaj|\bmontar/, 'Descarga y montaje'], [/\bcarg/, 'Carga'], [/\blimpi|\bvajilla/, 'Limpieza'],
  [/\brecog|\bdevol/, 'Recogida y devolución'], [/\bprepar|\bchecklist/, 'Preparación'], [/\bservicio|\bbodas?\b/, 'Servicio de boda'],
];

// «¿Quién suele llevar el camión Norte / recoger el generador / hacer las cargas?»: se
// contesta con lo aprendido (planning, grafo y fichajes), sin gastar Gemini. null si no
// es una pregunta así o no hay datos para contestarla.
export function respuestaDeConocimiento(peticion, { aprendizaje = null, semanas = {}, equipo = [] } = {}) {
  const p = plano(peticion);
  if (!/\bquien(es)?\b/.test(p) || !/\b(suele|suelen|lleva|llevan|hace|hacen|va|van|conduce|conducen|mejor|normalmente)\b/.test(p)) return null;
  const lista = (personas, unidad) => personas.slice(0, 4).map(x => `${x.nombre} (${x[unidad]}${unidad === 'horas' ? ' h' : x[unidad] === 1 ? ' vez' : ' veces'})`).join(', ');

  const camion = (aprendizaje?.planning?.camiones || []).find(c => {
    const clave = plano(c.camion).replace(/^camion\s+/, '').trim();
    return clave && new RegExp(`\\b${clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(p);
  });
  if (camion) return `Con el ${camion.camion} suelen ir: ${lista(camion.personas, 'veces')} (veces juntos en el planning).`;

  const items = itemsDeTexto(p);
  if (items.length) {
    const lineas = items.map(item => {
      const { lista: personas, fuente } = quienSueleHacerla(item, { semanas, aprendizaje, equipo });
      return personas.length ? `«${item.texto}»: ${lista(personas, fuente === 'planning' ? 'veces' : 'horas')}${fuente === 'planning' ? ' (otras semanas)' : ' (horas de ese tipo en los fichajes)'}.` : `«${item.texto}»: nadie la ha hecho aún.`;
    });
    return lineas.join('\n');
  }

  const tipo = TIPOS_EN_PREGUNTA.find(([re]) => re.test(p))?.[1];
  const porTipo = tipo && personasPorTipo(aprendizaje?.porPersona)[tipo];
  if (porTipo?.length) return `${tipo}: ${lista(porTipo, 'horas')} (horas fichadas).`;
  return null;
}

// Lo que el admin corrigió en «¿Quién va?» frente a lo que propuso Gemini, como reglas
// para proponer a la memoria (se aplican solo si el admin las aprueba): así el asistente
// aprende de cada corrección. → ['Para «Recoger generador 7k» prefiero a Ana.', …]
export function preferenciasDeCorrecciones(original, deGemini, final) {
  if (!original || !deGemini || !final) return [];
  const propuestas = new Map(tareasNuevas(original, deGemini).map(t => [t.clave, t.personas]));
  return tareasNuevas(original, final)
    .filter(t => t.personas.length && propuestas.has(t.clave))
    .filter(t => plano(t.personas.slice().sort().join(',')) !== plano(propuestas.get(t.clave).slice().sort().join(',')))
    .map(t => `Para «${t.texto}» prefiero a ${t.personas.join(' y ')}.`);
}
