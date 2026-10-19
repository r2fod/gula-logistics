// Cambios concretos en una semana ("pon a Luis en la carga del jueves") con el MÍNIMO
// de tokens: la semana va en una línea por tarea con un código corto (T1, T2…) en vez
// de en JSON, y Gemini solo devuelve la lista de cambios (no la semana entera). Los
// cambios se aplican aquí y pasan por las mismas comprobaciones que todo lo demás
// (completarPlanGenerado: lo hecho no se toca, nombres exactos, horarios, ids, Maps).
//
// Qué camino sigue cada petición (elegirModo):
//   · disponibilidad ("X no puede el jueves") → interpretarPeticion.js, 0 tokens;
//   · algo de la app que no es el cuadrante (tarifa, Saldos, festivos, disponibilidad
//     fija)                                   → acciones que se confirman (accionesIa.js);
//   · un cambio concreto                     → 'cambios' (este archivo);
//   · planificar o rehacer la semana          → 'completo' (generateScheduleWithGemini).
import { esTareaActiva, getDayLabel } from './taskPlanning';
import { getWeddingTaskName } from './eventNaming';
import { completarPlanGenerado, nombresPermitidos, semanaParaPrompt, semanaVacia } from './planificadorIa';
import { normalizarHorario } from './horarios';
import { generateScheduleWithGemini, pedirJsonAGemini } from './geminiScheduleService';
import { esMemoriaActiva } from './memoriaIa';
import { textoAprendizajeParaPrompt } from './aprendizajeFichajes';
import { LIMITES_POR_DEFECTO, limitesDe, restriccionesDe, restriccionesDelEquipo, restriccionesEfectivas, textosAgrupados } from './disponibilidad';
import { descripcionParaIa } from './equipoRoles';
import { interpretarDisponibilidad } from './interpretarPeticion';
import { reajustarSemana } from './optimizadorPlanning';
import { plano } from '../utils/texto';
import { formatWeekdayDayMonth } from '../utils/dateUtils';
import { buscarEnSemana, pideComprobarTareas, quienSueleHacerla, respuestaDeConocimiento, textoComprobacion } from './comprobarTareas';
import { accionesDeDisponibilidadFija, pedirAcciones, pideAccionDeApp, validarAccion } from './accionesIa';

const DIAS = ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
const ABREV = { martes: 'mar', miercoles: 'mie', jueves: 'jue', viernes: 'vie', sabado: 'sab', domingo: 'dom', lunes: 'lun' };
const DE_ABREV = Object.fromEntries(Object.entries(ABREV).map(([d, a]) => [a, d]));

// Planificar/rehacer la semana, o lo que necesita lo aprendido de los fichajes, va
// entero; todo lo demás, como cambios. Una semana vacía, siempre entera.
// Palabras ENTERAS: antes «GENERAdor 7K» contaba como «genera» y rehacía la semana.
export function elegirModo(peticion, semana) {
  if (semanaVacia(semanaParaPrompt(semana))) return 'completo';
  return /\b(planifica(r|la)?|genera(r|la)?|crea(r)? la semana|rehaz(la)?|haz de nuevo|desde cero|toda la semana|semana entera|semana completa|reorganiza toda|organiza toda|fichajes|lo que duran|duracion(es)?)\b/.test(plano(peticion)) ? 'completo' : 'cambios';
}

// ¿Suena a una regla para siempre? Solo entonces se gasta la llamada que la extrae
// para la memoria (antes se hacía en cada petición).
export const pareceRegla = (peticion) => /\b(siempre|nunca|a partir de ahora|de ahora en adelante|recuerda|cada vez|todas las semanas|normalmente|por norma|prefiere|no le gusta|no quiere|suele)\b/.test(plano(peticion));

// La semana en líneas "T3|jue|09:00-11:00|Boda X - Carga|Ana,Luis" (+ "|HECHA").
// `mapa` traduce cada código a su tarea real.
export function semanaEnLineas(semana) {
  const lineas = [];
  const mapa = {};
  let n = 0;
  const anadir = (lista, indice, dia, t, texto) => {
    if (!t || typeof t !== 'object' || !esTareaActiva(t)) return;
    const codigo = `T${++n}`;
    mapa[codigo] = { lista, indice, dia, hecha: !!t.completed };
    const partes = [codigo, ABREV[dia], String(t.timeFrame || '').replace(/\s+/g, ''), String(texto || '').trim(), (t.assigned || []).join(',')];
    if (t.completed) partes.push('HECHA');
    lineas.push(partes.join('|'));
  };
  DIAS.slice(0, 4).forEach(d => (semana?.schedule?.[d]?.tasks || []).forEach((t, i) => anadir(d, i, d, t, t?.text)));
  (semana?.saturdaySpecial?.weddings || []).forEach((b, i) => anadir('sabado', i, 'sabado', b, getWeddingTaskName(b)));
  (semana?.sundayMonday?.tasks || []).forEach((t, i) => anadir('cola', i, /domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes', t, t?.text));
  return { lineas, mapa };
}

export function esquemaCambios(nombres = []) {
  const TEXTO = { type: 'STRING' };
  return {
    type: 'OBJECT',
    properties: {
      cambios: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            op: { type: 'STRING', format: 'enum', enum: ['personas', 'horario', 'texto', 'quitar', 'nueva', 'mover'] },
            t: { type: 'STRING', description: 'código de la tarea (T1…)' },
            dia: { type: 'STRING', format: 'enum', enum: Object.values(ABREV) },
            horario: TEXTO, texto: TEXTO, lugar: TEXTO,
            personas: { type: 'ARRAY', items: nombres.length ? { type: 'STRING', format: 'enum', enum: nombres } : TEXTO },
          },
          required: ['op'],
          propertyOrdering: ['op', 't', 'dia', 'horario', 'texto', 'lugar', 'personas'],
        },
      },
    },
    required: ['cambios'],
  };
}

// El prompt más corto que sigue dando a Gemini todo lo que necesita para decidir bien.
// Lleva el día de hoy («mañana» o «esta tarde» no tenían a qué referirse). Con
// `pregunta`, pide una respuesta en texto en vez de cambios.
export function promptDeCambios({ semana, equipo = [], restricciones = [], limites = LIMITES_POR_DEFECTO, memorias = [], aprendizaje = null, peticion, ahora = new Date(), pregunta = false }) {
  const { lineas } = semanaEnLineas(semana);
  const dias = DIAS.map(d => `${ABREV[d]}=${getDayLabel(semana, d)}`).join(', ');
  const reglas = memorias.filter(esMemoriaActiva).map(m => m.content);
  return [
    `Planificador de Gula Logística (logística de bodas y eventos). Hoy es ${formatWeekdayDayMonth(ahora)}. Semana ${semana?.meta?.dateRange || ''} (${dias}).`,
    `Equipo: ${equipo.map(descripcionParaIa).join('; ')}.`,
    restricciones.length ? `No disponible: ${textosAgrupados(restricciones).join('; ')}.` : '',
    reglas.length ? `Preferencias: ${reglas.join('; ')}.` : '',
    textoAprendizajeParaPrompt(aprendizaje, 'Aprendido de los fichajes reales:').trim(),
    `Reglas: recogidas con 1 persona salvo que se pida; nadie en dos tareas a la vez; máx ${limites.maxHorasDia} h/día y ${limites.descansoMinHoras} h de descanso entre jornadas; limpieza solo limpia; el jefe supervisa y no carga; texto "EVENTO - Tarea"; las HECHA no se tocan.`,
    'Tareas (código|día|horario|tarea|personas):',
    ...lineas,
    ...(pregunta ? [
      `Pregunta: ${peticion}`,
      'Contesta en "respuesta", en español y corto (6 líneas como mucho), solo con lo que dicen estos datos; si con ellos no se puede saber, dilo. Nombra las tareas por su día, hora y texto, nunca por su código (T1…). No propongas cambios.',
    ] : [
      `Petición: ${peticion}`,
      'Devuelve SOLO los cambios mínimos que pide la petición: no cambies horarios ni personas de otras tareas. Si piden añadir algo que ya está (aunque esté escrito distinto), no lo dupliques. op: personas (lista completa nueva), horario ("HH:MM-HH:MM"), texto, quitar, nueva (con dia, horario, texto, lugar y personas), mover (t y dia: la pasa a otro día con su hora y su gente; el sábado no).',
    ]),
  ].filter(Boolean).join('\n');
}

// Aplica los cambios sobre una copia de la planificación. Lo que no se entiende o toca
// una tarea HECHA se ignora y se cuenta. «mover» pasa la tarea entera (hora, gente, lugar,
// teléfono…) a otro día de la semana, al final y con los demás cambios que lleve; el
// sábado (bodas, con otra forma) no entra ni sale así.
export function aplicarCambios(semana, cambios = [], mapa = {}) {
  const plan = JSON.parse(JSON.stringify({
    schedule: semana?.schedule || {}, saturdaySpecial: semana?.saturdaySpecial || { weddings: [] }, sundayMonday: semana?.sundayMonday || { tasks: [] },
  }));
  DIAS.slice(0, 4).forEach(d => { plan.schedule[d] = { ...(plan.schedule[d] || {}), tasks: plan.schedule[d]?.tasks || [] }; });
  plan.saturdaySpecial.weddings = plan.saturdaySpecial.weddings || [];
  plan.sundayMonday.tasks = plan.sundayMonday.tasks || [];
  const listaDe = (lista) => (lista === 'sabado' ? plan.saturdaySpecial.weddings : lista === 'cola' ? plan.sundayMonday.tasks : plan.schedule[lista].tasks);
  const quitar = new Set();
  const mover = [];
  let aplicados = 0;
  let ignorados = 0;

  (Array.isArray(cambios) ? cambios : []).forEach(c => {
    if (c?.op === 'nueva') {
      const dia = DE_ABREV[c.dia] || c.dia;
      if (!DIAS.includes(dia) || !c.texto || !c.horario) { ignorados += 1; return; }
      const base = { timeFrame: normalizarHorario(c.horario), location: c.lugar || '', assigned: c.personas || [] };
      if (dia === 'sabado') plan.saturdaySpecial.weddings.push({ ...base, details: c.texto });
      else if (dia === 'domingo' || dia === 'lunes') plan.sundayMonday.tasks.push({ ...base, text: c.texto, targetDay: dia === 'domingo' ? 'Domingo' : 'Lunes' });
      else plan.schedule[dia].tasks.push({ ...base, text: c.texto });
      aplicados += 1;
      return;
    }
    const ref = mapa[c?.t];
    if (!ref || ref.hecha) { ignorados += 1; return; }
    const tarea = listaDe(ref.lista)[ref.indice];
    if (c.op === 'quitar') quitar.add(tarea);
    else if (c.op === 'personas' && Array.isArray(c.personas)) tarea.assigned = c.personas;
    else if (c.op === 'horario' && c.horario) tarea.timeFrame = normalizarHorario(c.horario);
    else if (c.op === 'texto' && c.texto) { if (ref.lista === 'sabado') tarea.details = c.texto; else tarea.text = c.texto; }
    else if (c.op === 'mover' && DIAS.includes(DE_ABREV[c.dia] || c.dia) && (DE_ABREV[c.dia] || c.dia) !== ref.dia && ref.lista !== 'sabado' && (DE_ABREV[c.dia] || c.dia) !== 'sabado') mover.push({ tarea, dia: DE_ABREV[c.dia] || c.dia });
    else { ignorados += 1; return; }
    aplicados += 1;
  });

  mover.forEach(({ tarea, dia }) => {
    quitar.add(tarea);
    const movida = { ...tarea };
    delete movida.id; // el del día nuevo (m1, j2…) lo pone completarPlanGenerado
    if (dia === 'domingo' || dia === 'lunes') plan.sundayMonday.tasks.push({ ...movida, targetDay: dia === 'domingo' ? 'Domingo' : 'Lunes' });
    else { delete movida.targetDay; plan.schedule[dia].tasks.push(movida); }
  });
  DIAS.slice(0, 4).forEach(d => { plan.schedule[d].tasks = plan.schedule[d].tasks.filter(t => !quitar.has(t)); });
  plan.saturdaySpecial.weddings = plan.saturdaySpecial.weddings.filter(t => !quitar.has(t));
  plan.sundayMonday.tasks = plan.sundayMonday.tasks.filter(t => !quitar.has(t));
  return { plan, aplicados, ignorados };
}

const eventosDe = (semana) => (semana?.events || []).map(e => e?.name).filter(Boolean);

// Lo común a un cambio concreto y a la revisión de un borrador: prompt compacto,
// respuesta con solo los cambios y aplicarlos sobre una copia. Lanza si Gemini falla.
// `soloNuevas`: la petición es SOLO añadir tareas; cualquier otro cambio que proponga se descarta.
async function pedirCambios({ peticion, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje = null, soloNuevas = false, ahora = new Date() }) {
  const { mapa } = semanaEnLineas(semana);
  const { json, uso } = await pedirJsonAGemini({
    apiKey,
    texto: promptDeCambios({ semana, equipo, restricciones, limites, memorias, aprendizaje, peticion, ahora }),
    esquema: esquemaCambios(nombresPermitidos({ equipo, semana })),
    temperatura: 0.2,
    // Razonamiento acotado: suficiente para decidir cambios concretos, sin gastar de más.
    extras: { thinkingConfig: { thinkingBudget: 512 } },
  });
  const cambios = Array.isArray(json.cambios) ? json.cambios : [];
  const validos = soloNuevas ? cambios.filter(c => c?.op === 'nueva') : cambios;
  const r = aplicarCambios(semana, validos, mapa);
  return { ...r, ignorados: r.ignorados + (cambios.length - validos.length), uso };
}

// Petición → cambios de Gemini → planificación completa y revisada.
// Devuelve lo mismo que generateScheduleWithGemini, más { aplicados, ignorados }. Sin
// cambios no es un error (una regla para siempre, o la semana ya lo cumple): se dice.
export async function editarConGemini({ peticion, apiKey, semana, equipo = [], restricciones = [], limites = LIMITES_POR_DEFECTO, memorias = [], aprendizaje = null, soloNuevas = false, ahora = new Date() }) {
  try {
    const { plan, aplicados, ignorados, uso } = await pedirCambios({ peticion, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje, soloNuevas, ahora });
    if (!aplicados && !ignorados) return { generatedJson: null, errorMsg: '', uso, aplicados: 0, ignorados: 0, resumen: 'Gemini no ve nada que cambiar en esta semana con esa petición.' };
    if (!aplicados) throw new Error('los cambios que propuso no se pueden aplicar (tareas hechas o que no existen)');
    return { generatedJson: completarPlanGenerado(plan, { original: semana, equipo, eventNames: eventosDe(semana) }), errorMsg: '', uso, aplicados, ignorados };
  } catch (err) {
    console.error(err);
    return { generatedJson: null, errorMsg: `No se pudo cambiar con Gemini: ${err.message}. No se ha tocado nada.` };
  }
}

// Lo que se le pide al revisar un borrador (el prompt fijo, ya optimizado).
export const PETICION_REVISION = 'Revisa este borrador y mejóralo solo si hace falta, con cambios mínimos: respeta la disponibilidad y las preferencias; ajusta los horarios a las duraciones reales aprendidas; que la misma gente haga la carga y la descarga de un mismo evento cuando se pueda; reparte las horas de forma equilibrada entre quien pueda hacerlo. Si ya está bien, devuelve la lista de cambios vacía.';

// Revisión de un borrador (el calendario lo crea, Gemini lo mejora, el admin da el
// toque final). Después de sus cambios, el optimizador arregla lo que hubiera roto
// de las reglas estrictas (disponibilidad, solapes). Sin cambios no es un error:
// → { generatedJson (null si no cambia nada), aplicados, uso, avisos, errorMsg }
export async function revisarBorradorConGemini({ semana, apiKey, equipo = [], memorias = [], aprendizaje = null, ahora = new Date() }) {
  const restricciones = restriccionesEfectivas(semana, equipo);
  const limites = limitesDe(semana);
  try {
    const { plan, aplicados, uso } = await pedirCambios({ peticion: PETICION_REVISION, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje, ahora });
    if (!aplicados) return { generatedJson: null, aplicados: 0, uso, avisos: [], errorMsg: '' };
    const propuesta = { ...semana, ...completarPlanGenerado(plan, { original: semana, equipo, eventNames: eventosDe(semana) }) };
    const reparada = reajustarSemana(propuesta, { equipo, restricciones, limites, ahora });
    const final = reparada.error ? propuesta : reparada.semana;
    return {
      generatedJson: { schedule: final.schedule, saturdaySpecial: final.saturdaySpecial, sundayMonday: final.sundayMonday },
      aplicados, uso, avisos: reparada.avisos || [], errorMsg: '',
    };
  } catch (err) {
    console.error(err);
    return { generatedJson: null, aplicados: 0, errorMsg: `No se pudo revisar con Gemini: ${err.message}.` };
  }
}

// ¿Pregunta algo sin pedir que se cambie? («¿Qué hay el sábado?», «¿cuántas horas tiene
// Ana?»). Antes iba por el camino de los cambios y acababa en «no ha propuesto ningún
// cambio». «¿Puedes poner a Ana…?» es un cambio pedido con educación, no una pregunta.
export function esPregunta(peticion) {
  const p = plano(peticion);
  const pregunta = /[?¿]/.test(peticion) || /^\s*(que|cuanto|cuanta|cuantos|cuantas|quien|quienes|como|cuando|donde|cual|cuales|por que)\b/.test(p);
  return pregunta && !/\b(puedes|podrias|pon|ponle|ponlo|ponla|cambia|cambiale|mueve|quita|anade|asigna|rehaz|haz|crea|borra|elimina|sustituye|reorganiza|organiza|ajusta|planifica|genera)\b/.test(p);
}

// Una pregunta sobre la semana: Gemini contesta en texto con los mismos datos que ve
// para un cambio (la semana en líneas, equipo, disponibilidad…). No cambia nada.
// → { generatedJson: null, errorMsg, uso, resumen }
export async function responderConGemini({ peticion, apiKey, semana, equipo = [], restricciones = [], limites = LIMITES_POR_DEFECTO, memorias = [], aprendizaje = null, ahora = new Date() }) {
  try {
    const { json, uso } = await pedirJsonAGemini({
      apiKey,
      texto: promptDeCambios({ semana, equipo, restricciones, limites, memorias, aprendizaje, peticion, ahora, pregunta: true }),
      esquema: { type: 'OBJECT', properties: { respuesta: { type: 'STRING' } }, required: ['respuesta'] },
      temperatura: 0.2,
      extras: { thinkingConfig: { thinkingBudget: 512 } },
    });
    const respuesta = String(json?.respuesta || '').trim();
    if (!respuesta) throw new Error('no ha contestado');
    return { generatedJson: null, errorMsg: '', uso, resumen: respuesta };
  } catch (err) {
    console.error(err);
    return { generatedJson: null, errorMsg: `No se pudo contestar con Gemini: ${err.message}.` };
  }
}

// "¿Qué puedes hacer?", "ayuda"…: se contesta aquí, sin gastar Gemini.
const PREGUNTA_DE_AYUDA = /\b(que (puedes|sabes) hacer|ayuda|como (funcionas|funciona|te uso|se usa)|que haces|para que sirves|instrucciones)\b/;
export const esPreguntaDeAyuda = (peticion) => PREGUNTA_DE_AYUDA.test(plano(peticion));
export function textoDeAyuda(equipo = []) {
  const [a = 'Luis', b = 'Ana'] = equipo.map(w => w.name.split(/\s+/)[0]);
  return [
    'Trabajo sobre la semana abierta y siempre te enseño los cambios antes de aplicarlos:',
    `• Disponibilidad, sin gastar Gemini: «${a} no puede el jueves», «${b} solo de 9 a 14 el viernes», «${a} descansa el fin de semana».`,
    `• Cambios concretos: «Pon a ${b} en la carga del jueves», «Mueve la recogida del miércoles a las 8:00».`,
    '• Preguntas sobre la semana: «¿Qué tareas tiene ' + a + ' el jueves?», «¿Quién hace la carga del viernes?».',
    `• Cambios en la app (te los enseño y los aplicas tú): «${b} cobra 12 € la hora desde el día 4», «Apunta 10 € de transporte a ${a} del lunes», «El 8 de diciembre es festivo», «${a} nunca puede los lunes», «Pasa la recogida del martes al miércoles».`,
    '• Rehacer la semana: «Rehaz toda la semana repartiendo mejor las horas».',
    '• Reglas para siempre: «A partir de ahora, las bodas grandes llevan un apoyo más en la carga».',
  ].join('\n');
}

// El enrutador: cada petición por el camino que menos gasta.
// → { generatedJson, errorMsg, via: 'local' | 'acciones' | 'pregunta' | 'cambios' | 'completo', uso, resumen?, avisosExtra?, acciones? }
// `acciones`: lo que se propone hacer fuera del cuadrante, ya comprobado (validarAccion);
// `fichajes` hace falta para decir cuántos cambian con una tarifa «desde el día X».
// En 'local', generatedJson lleva además `disponibilidad` (lo que se ha entendido),
// para guardarlo en la semana al aplicar.
export async function resolverPeticion({ peticion, apiKey, semana, equipo = [], memorias = [], aprendizaje = null, semanas = {}, ahora = new Date(), fichajes = [] }) {
  if (esPreguntaDeAyuda(peticion)) return { generatedJson: null, errorMsg: '', via: 'local', uso: null, resumen: textoDeAyuda(equipo) };
  // «¿Quién suele…?»: lo sabe la app (planning, grafo y fichajes), sin gastar Gemini.
  const sabe = respuestaDeConocimiento(peticion, { aprendizaje, semanas, equipo, semana });
  if (sabe) return { generatedJson: null, errorMsg: '', via: 'local', uso: null, resumen: sabe };

  const restricciones = restriccionesEfectivas(semana, equipo);
  const limites = limitesDe(semana);

  // «¿Hay … en el planning? Si no, añádelo»: se mira aquí (0 tokens). Si todo está, o no
  // pide añadir, se contesta sin Gemini; si falta algo, Gemini SOLO añade eso (día y hora)
  // y el admin elige quién va (sugerencias: quién la suele hacer).
  const comprobacion = pideComprobarTareas(peticion);
  if (comprobacion) {
    const resultados = comprobacion.items.map(item => ({ item, encontradas: buscarEnSemana(semana, item), suelen: quienSueleHacerla(item, { semanas, aprendizaje, equipo }) }));
    const resumen = textoComprobacion(resultados);
    const faltan = resultados.filter(r => !r.encontradas.length);
    if (!faltan.length || !comprobacion.anadir) return { generatedJson: null, errorMsg: '', via: 'local', uso: null, resumen };
    const peticionAcotada = `Añade SOLO estas tareas, que faltan en la semana (no cambies ni quites ninguna otra): ${faltan.map(f => `«${f.item.texto}»${f.suelen.lista.length ? ` (suelen hacerla: ${f.suelen.lista.slice(0, 3).map(p => p.nombre).join(', ')})` : ''}`).join('; ')}. Elige día y hora sensatos según el resto de la semana.`;
    const r = await editarConGemini({ peticion: peticionAcotada, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje, soloNuevas: true, ahora });
    return { ...r, via: 'cambios', resumen, sugerencias: faltan.map(f => ({ item: f.item, suelen: f.suelen })) };
  }

  // «Eva nunca puede los lunes»: su disponibilidad FIJA (ficha del equipo), sin Gemini.
  const comprobar = (lista) => lista.map(a => validarAccion(a, { equipo, fichajes, ahora }));
  const fija = accionesDeDisponibilidadFija(peticion, equipo);
  if (fija) return { generatedJson: null, errorMsg: '', via: 'local', uso: null, acciones: comprobar(fija), resumen: 'Entendido sin gastar Gemini: es para todas las semanas (su ficha del equipo). Revísalo y pulsa «Aplicar».' };

  const nuevas = interpretarDisponibilidad(peticion, equipo, { semana, ahora });
  if (nuevas) {
    // En la semana solo se guardan las de la semana; las fijas del equipo cuentan igual.
    const todas = [...restriccionesDe(semana), ...nuevas];
    const r = reajustarSemana({ ...semana, meta: { ...semana?.meta, disponibilidad: todas } }, { equipo, restricciones: [...restriccionesDelEquipo(equipo), ...todas], limites, ahora });
    if (r.error) return { generatedJson: null, errorMsg: r.error, via: 'local', uso: null };
    const cuantos = r.cambios.length;
    return {
      generatedJson: { schedule: r.semana.schedule, saturdaySpecial: r.semana.saturdaySpecial, sundayMonday: r.semana.sundayMonday, disponibilidad: todas },
      errorMsg: '', via: 'local', uso: null, avisosExtra: r.avisos,
      resumen: `Entendido sin gastar Gemini: ${textosAgrupados(nuevas).join('; ')}. ${cuantos ? `${cuantos} ${cuantos === 1 ? 'tarea cambia' : 'tareas cambian'} de persona.` : 'No hace falta cambiar a nadie.'}`,
    };
  }

  // Tarifa, Saldos o festivos: Gemini propone acciones del catálogo y el admin las aplica. Si
  // no ve ninguna (era del cuadrante), sigue por el camino de siempre.
  if (!esPregunta(peticion) && pideAccionDeApp(peticion)) {
    try {
      const { acciones, aclaracion, uso } = await pedirAcciones({ peticion, apiKey, equipo, semana, ahora });
      if (acciones.length || aclaracion) {
        return { generatedJson: null, errorMsg: '', via: 'acciones', uso, acciones: comprobar(acciones), resumen: aclaracion || 'Esto es lo que he entendido: revísalo y pulsa «Aplicar».' };
      }
    } catch (err) {
      console.error(err);
      return { generatedJson: null, errorMsg: `No se pudo entender con Gemini: ${err.message}. No se ha tocado nada.`, via: 'acciones' };
    }
  }

  if (esPregunta(peticion)) {
    return { ...(await responderConGemini({ peticion, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje, ahora })), via: 'pregunta' };
  }
  if (elegirModo(peticion, semana) === 'cambios') {
    return { ...(await editarConGemini({ peticion, apiKey, semana, equipo, restricciones, limites, memorias, aprendizaje, ahora })), via: 'cambios' };
  }
  return { ...(await generateScheduleWithGemini({ prompt: peticion, apiKey, activeWeekData: semana, roster: equipo, aiMemories: memorias, aprendizaje, ahora })), via: 'completo' };
}
