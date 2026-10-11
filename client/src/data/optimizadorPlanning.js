// Quién hace cada tarea de una semana, de la forma más repartida posible y sin que
// nadie haga un montón de horas. Lo usan el generador del calendario (borradores) y
// el reajuste del planning cuando alguien no puede un día (reajustarSemana).
//
// Reglas, de más a menos importantes:
//   1. ESTRICTAS: vacaciones, lo que el admin dijo de cada persona (disponibilidad.js)
//      y nadie en dos tareas a la vez (también de un día al siguiente: una boda
//      que acaba a las 00:30 cuenta).
//   2. A EVITAR: pasar de `maxHorasDia` en un día y descansar menos de
//      `descansoMinHoras` entre jornadas. Solo si no hay nadie más, y con aviso.
//   3. REPARTO: a igualdad, quien lleva menos horas en la semana (el "backup" solo
//      cuando los demás van cargados).
// Primero se colocan las tareas con menos gente posible (las difíciles) y al final
// se pasan tareas de quien más lleva a quien menos mientras mejore el reparto.
import { mismoNombre, parecidoNombre } from './nombresTrabajadores';
import { esTareaActiva, getWeekRange, resolveTaskDate } from './taskPlanning';
import { getWeddingTaskName } from './eventNaming';
import { formatearHoras } from './formatoFinanciero';
import { LIMITES_POR_DEFECTO, NOMBRE_DIA, restriccionQueBloquea, textoRestriccion } from './disponibilidad';
import { tramoDeHorario } from './horarios';
import { candidatosDePerfil, clasificarEquipo, esBackup as marcadoBackup } from './equipoRoles';

const DIAS = ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
const DIA_IDX = Object.fromEntries(DIAS.map((d, i) => [d, i]));
const PENALIZACION_BACKUP = 6; // horas: el "backup" solo entra cuando los demás van cargados

// El perfil de una tarea que no lo trae guardado (hecha a mano o antigua), por su texto;
// si no se reconoce, el de quien la tiene asignada.
const REGLAS_PERFIL = [
  [/limpieza/i, 'limpieza'],
  [/supervisi/i, 'supervisor'],
  [/preparaci[oó]n y organizaci|checklist/i, 'prepEquipo'],
  [/comida y montaje|montaje final/i, 'equipo'],
  [/descarga adelantada|recog|devol|vuelta a base/i, 'conductores'],
  [/carga|descarga|montaje/i, 'carga'],
];
export function perfilDeTarea(texto, asignados = [], pools = null) {
  const regla = REGLAS_PERFIL.find(([re]) => re.test(texto || ''));
  if (regla) return regla[1];
  if (pools && asignados.length) {
    const suyos = new Set(asignados.map(n => Object.keys(pools).find(k => pools[k].some(p => mismoNombre(p.name, n)))).filter(Boolean));
    if (suyos.size === 1) return [...suyos][0];
  }
  return 'equipo';
}

// ─── El reparto ─────────────────────────────────────────────────────────────
// tareas: [{ clave, dia, ini, fin, n, candidatos: [nombres por preferencia], fijos?: [nombres que se quedan], etiqueta }]
// fijas:  [{ clave, dia, ini, fin, personas }] — ya hechas o empezadas: cuentan, pero no se tocan.
// → { asignados: { [clave]: [nombres] }, horas: { nombre: h }, avisos: [] }
export function asignarEquipo({ tareas = [], equipo = [], restricciones = [], limites = LIMITES_POR_DEFECTO, vacaciones = [], fechas = {}, fijas = [] } = {}) {
  const agenda = new Map(); // persona → [{ clave, dia, ini, fin }] en minutos desde el martes 00:00
  const horas = {};
  equipo.forEach(p => { horas[p.name] = 0; });
  const esBackup = new Set(equipo.filter(marcadoBackup).map(p => p.name));
  const abs = (dia, min) => DIA_IDX[dia] * 1440 + min;
  const itemDe = (t) => ({ clave: t.clave, dia: t.dia, ini: abs(t.dia, t.ini), fin: abs(t.dia, t.fin) });
  const duracion = (it) => (it.fin - it.ini) / 60;
  const poner = (p, it) => { if (!agenda.has(p)) agenda.set(p, []); agenda.get(p).push(it); horas[p] = (horas[p] || 0) + duracion(it); };
  const quitar = (p, clave) => {
    const lista = agenda.get(p) || [];
    const i = lista.findIndex(x => x.clave === clave);
    if (i >= 0) horas[p] -= duracion(lista.splice(i, 1)[0]);
  };

  fijas.forEach(f => (f.personas || []).forEach(p => poner(p, itemDe({ ...f, clave: `fija|${f.clave}` }))));
  const asignados = {};
  tareas.forEach(t => {
    asignados[t.clave] = [...(t.fijos || [])];
    (t.fijos || []).forEach(p => poner(p, itemDe(t)));
  });

  const deVacaciones = (p, dia) => !!fechas[dia] && vacaciones.some(v => parecidoNombre(v.nombre, p) >= 2 && fechas[dia] >= v.desde && fechas[dia] <= v.hasta);
  const solapa = (p, it) => (agenda.get(p) || []).some(x => x.clave !== it.clave && it.ini < x.fin && x.ini < it.fin);
  const bloqueado = (p, t, it) => deVacaciones(p, t.dia) || !!restriccionQueBloquea(restricciones, p, t.dia, t.ini, t.fin) || solapa(p, it);
  const jornada = (p, dia, it) => {
    const lista = (agenda.get(p) || []).filter(x => x.dia === dia && x.clave !== it?.clave);
    if (it && it.dia === dia) lista.push(it);
    return lista.length ? { ini: Math.min(...lista.map(x => x.ini)), fin: Math.max(...lista.map(x => x.fin)), horas: lista.reduce((s, x) => s + duracion(x), 0) } : null;
  };
  // Cuántas de las dos reglas "a evitar" rompería p haciendo esta tarea (0, 1 o 2).
  const incumple = (p, t, it) => {
    const hoy = jornada(p, t.dia, it);
    let n = hoy.horas > limites.maxHorasDia + 1e-9 ? 1 : 0;
    const minimo = limites.descansoMinHoras * 60;
    const i = DIA_IDX[t.dia];
    const antes = i > 0 ? jornada(p, DIAS[i - 1], it) : null;
    const despues = i < DIAS.length - 1 ? jornada(p, DIAS[i + 1], it) : null;
    if (minimo && ((antes && hoy.ini - antes.fin < minimo) || (despues && despues.ini - hoy.fin < minimo))) n += 1;
    return n;
  };
  const coste = (p, t, it, pos) => incumple(p, t, it) * 1000 + (horas[p] || 0) + (esBackup.has(p) ? PENALIZACION_BACKUP : 0) + pos * 0.001;

  // 1. Primero las tareas con menos margen (menos gente libre para las que faltan).
  const pendientes = tareas
    .map(t => ({ t, it: itemDe(t), faltan: Math.max(0, (t.n || 0) - (t.fijos || []).length) }))
    .filter(x => x.faltan > 0);
  const margen = (x) => (x.t.candidatos || []).filter(p => !asignados[x.t.clave].includes(p) && !bloqueado(p, x.t, x.it)).length - x.faltan;
  const margenes = new Map(pendientes.map(x => [x, margen(x)]));
  pendientes.sort((a, b) => margenes.get(a) - margenes.get(b) || a.it.ini - b.it.ini);

  const avisos = [];
  pendientes.forEach(x => {
    for (let k = 0; k < x.faltan; k++) {
      const mejor = (x.t.candidatos || [])
        .map((p, pos) => ({ p, pos }))
        .filter(({ p }) => !asignados[x.t.clave].includes(p) && !bloqueado(p, x.t, x.it))
        .map(c => ({ ...c, coste: coste(c.p, x.t, x.it, c.pos) }))
        .sort((a, b) => a.coste - b.coste)[0];
      if (!mejor) {
        const puestos = asignados[x.t.clave].length;
        avisos.push(`${x.t.etiqueta}: solo ${puestos} de ${x.t.n} personas libres (disponibilidad, descansos o solapes).`);
        break;
      }
      poner(mejor.p, x.it);
      asignados[x.t.clave].push(mejor.p);
    }
  });

  // 2. Repartir mejor: pasar una tarea de p a q si le quita a p una regla rota o si
  // iguala las horas de la semana (q acaba con menos que las que tenía p).
  for (let vuelta = 0; vuelta < 300; vuelta++) {
    let mejor = null;
    pendientes.forEach(x => {
      const dur = duracion(x.it);
      asignados[x.t.clave].forEach(p => {
        if ((x.t.fijos || []).includes(p)) return;
        const rotasP = incumple(p, x.t, x.it);
        (x.t.candidatos || []).forEach(q => {
          if (asignados[x.t.clave].includes(q) || bloqueado(q, x.t, x.it)) return;
          const rotasQ = incumple(q, x.t, x.it);
          const igualado = (horas[p] || 0) - ((horas[q] || 0) + dur) - (esBackup.has(q) && !esBackup.has(p) ? PENALIZACION_BACKUP : 0);
          const ganancia = (rotasP - rotasQ) * 1000 + igualado;
          if (rotasQ > rotasP || ganancia <= 1e-6 || (mejor && ganancia <= mejor.ganancia)) return;
          mejor = { x, p, q, ganancia };
        });
      });
    });
    if (!mejor) break;
    const { x, p, q } = mejor;
    quitar(p, x.t.clave);
    poner(q, x.it);
    asignados[x.t.clave] = asignados[x.t.clave].map(n => (n === p ? q : n));
  }

  return { asignados, horas, avisos: [...avisos, ...avisosDeCarga(agenda, limites)] };
}

// Lo que ha quedado por encima de los límites (solo si no había nadie más libre).
function avisosDeCarga(agenda, limites) {
  const avisos = [];
  agenda.forEach((lista, p) => {
    const porDia = DIAS.map(d => {
      const del = lista.filter(x => x.dia === d);
      return del.length ? { d, ini: Math.min(...del.map(x => x.ini)), fin: Math.max(...del.map(x => x.fin)), horas: del.reduce((s, x) => s + (x.fin - x.ini) / 60, 0) } : null;
    });
    porDia.forEach((j, i) => {
      if (!j) return;
      if (j.horas > limites.maxHorasDia + 1e-9) avisos.push(`${p} tiene ${formatearHoras(j.horas)} el ${NOMBRE_DIA[j.d].toLowerCase()} (más de ${limites.maxHorasDia}\u00a0h): no había nadie más libre.`);
      const siguiente = porDia[i + 1];
      const descanso = siguiente ? (siguiente.ini - j.fin) / 60 : null;
      if (descanso !== null && limites.descansoMinHoras && descanso < limites.descansoMinHoras) {
        avisos.push(`${p} descansa solo ${formatearHoras(Math.max(0, descanso))} entre el ${NOMBRE_DIA[j.d].toLowerCase()} y el ${NOMBRE_DIA[siguiente.d].toLowerCase()} (mínimo ${limites.descansoMinHoras}\u00a0h).`);
      }
    });
  });
  return avisos;
}

// ─── Sobre una semana ya hecha ──────────────────────────────────────────────
// Todas las tareas activas con horario: { clave, lista, indice, dia, ini, fin, texto, asignados, hecha, perfil, personas }.
export function tareasDelPlanning(semana) {
  const out = [];
  const anadir = (lista, indice, dia, t, texto) => {
    if (!t || typeof t !== 'object' || !esTareaActiva(t)) return;
    const tramo = tramoDeHorario(t.timeFrame);
    if (!tramo) return;
    out.push({
      clave: `${lista}|${indice}`, lista, indice, dia, ...tramo, texto: String(texto || '').trim(),
      asignados: Array.isArray(t.assigned) ? t.assigned : [], hecha: !!t.completed, perfil: t.perfil || null, personas: Number(t.personas) || null,
    });
  };
  DIAS.slice(0, 4).forEach(d => (semana?.schedule?.[d]?.tasks || []).forEach((t, i) => anadir(d, i, d, t, t?.text)));
  (semana?.saturdaySpecial?.weddings || []).forEach((b, i) => anadir('sabado', i, 'sabado', b, getWeddingTaskName(b)));
  (semana?.sundayMonday?.tasks || []).forEach((t, i) => anadir('cola', i, /domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes', t, t?.text));
  return out;
}

const etiquetaDe = (t) => `${NOMBRE_DIA[t.dia]}: ${t.texto}`;

// Lo que incumple el planning tal como está: disponibilidad, horas al día y descansos.
export function revisarPlanning(semana, { restricciones = [], limites = LIMITES_POR_DEFECTO } = {}) {
  const tareas = tareasDelPlanning(semana);
  const avisos = [];
  tareas.forEach(t => t.asignados.forEach(p => {
    const r = restriccionQueBloquea(restricciones, p, t.dia, t.ini, t.fin);
    if (r) avisos.push(`${etiquetaDe(t)} — ${p}, pero ${textoRestriccion(r).replace(/^\S+\s/, '')}.`);
  }));
  const agenda = new Map();
  tareas.forEach(t => t.asignados.forEach(p => {
    if (!agenda.has(p)) agenda.set(p, []);
    agenda.get(p).push({ clave: t.clave, dia: t.dia, ini: DIA_IDX[t.dia] * 1440 + t.ini, fin: DIA_IDX[t.dia] * 1440 + t.fin });
  }));
  return [...avisos, ...avisosDeCarga(agenda, limites)];
}

// Vuelve a repartir la gente de una semana respetando la disponibilidad y los límites.
//   modo 'reparar'    → solo cambia a quien ya no puede (o se solapa); el resto se queda.
//   modo 'equilibrar' → reparte de nuevo todas las tareas pendientes.
// Lo hecho y lo que ya ha empezado no se toca nunca.
// → { semana, cambios: [{ etiqueta, sale, entra }], avisos } o { error }
export function reajustarSemana(semana, { equipo = [], restricciones = [], limites = LIMITES_POR_DEFECTO, ahora = new Date(), modo = 'reparar' } = {}) {
  const rango = getWeekRange(semana, ahora);
  if (!rango) return { error: 'No se pueden leer las fechas de la semana (meta.dateRange).' };
  const pools = clasificarEquipo(equipo);
  const todas = tareasDelPlanning(semana);
  const empezada = (t) => {
    const fecha = resolveTaskDate(rango, t.dia);
    return !!fecha && new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, t.ini) <= ahora;
  };
  const fijas = todas.filter(t => t.hecha || empezada(t));
  const libres = todas.filter(t => !fijas.includes(t)).sort((a, b) => DIA_IDX[a.dia] - DIA_IDX[b.dia] || a.ini - b.ini);

  // En 'reparar' se quedan quienes siguen pudiendo (por orden de hora, sin solaparse).
  const quedan = {};
  const ocupado = new Map();
  fijas.forEach(t => t.asignados.forEach(p => { if (!ocupado.has(p)) ocupado.set(p, []); ocupado.get(p).push([DIA_IDX[t.dia] * 1440 + t.ini, DIA_IDX[t.dia] * 1440 + t.fin]); }));
  libres.forEach(t => {
    const [a, b] = [DIA_IDX[t.dia] * 1440 + t.ini, DIA_IDX[t.dia] * 1440 + t.fin];
    quedan[t.clave] = modo === 'reparar' ? t.asignados.filter(p => {
      const puede = !restriccionQueBloquea(restricciones, p, t.dia, t.ini, t.fin) && !(ocupado.get(p) || []).some(([x, y]) => a < y && x < b);
      if (puede) { if (!ocupado.has(p)) ocupado.set(p, []); ocupado.get(p).push([a, b]); }
      return puede;
    }) : [];
  });

  const { asignados, avisos } = asignarEquipo({
    equipo, restricciones, limites,
    fijas: fijas.map(t => ({ clave: t.clave, dia: t.dia, ini: t.ini, fin: t.fin, personas: t.asignados })),
    tareas: libres.map(t => ({
      clave: t.clave, dia: t.dia, ini: t.ini, fin: t.fin, etiqueta: etiquetaDe(t),
      n: Math.max(t.personas || 0, t.asignados.length, 1),
      candidatos: candidatosDePerfil(pools, t.perfil || perfilDeTarea(t.texto, t.asignados, pools)).map(p => p.name),
      fijos: quedan[t.clave],
    })),
  });

  const nueva = JSON.parse(JSON.stringify(semana));
  const listaDe = (t) => (t.lista === 'sabado' ? nueva.saturdaySpecial.weddings : t.lista === 'cola' ? nueva.sundayMonday.tasks : nueva.schedule[t.lista].tasks);
  const cambios = [];
  libres.forEach(t => {
    const nuevos = asignados[t.clave] || [];
    const sale = t.asignados.filter(p => !nuevos.includes(p));
    const entra = nuevos.filter(p => !t.asignados.includes(p));
    if (!sale.length && !entra.length) return;
    listaDe(t)[t.indice].assigned = nuevos;
    cambios.push({ etiqueta: etiquetaDe(t), sale, entra });
  });
  return { semana: nueva, cambios, avisos };
}
