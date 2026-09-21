// Generador del BORRADOR de una semana a partir de los apuntes del calendario.
//
// Es una función pura (sin red ni reloj): recibe los apuntes ya leídos por el
// servidor (server/src/services/calendario.js), la plantilla del equipo y devuelve
// la semana lista para guardar como borrador, más un resumen con los avisos
// (lo que el calendario no decía y se ha propuesto, o lo que no se ha podido
// cubrir). Un humano lo revisa y lo acepta: nada de aquí llega a los
// trabajadores sin ese paso.
//
// Reglas de negocio aplicadas (ver CONTEXTO.md):
//   · texto de cada tarea "EVENTO - Tarea" (eventNaming.js);
//   · una sola persona en las recogidas; las de alquiler, por la mañana salvo hora;
//   · cargas/descargas las hacen conductores y apoyo; Irene prepara, Raúl
//     supervisa, Kerly y Jose solo limpian;
//   · descargar implica montaje de estructura;
//   · nadie se asigna dos tareas a la vez ni en sus vacaciones.
// Los horarios se calculan desde la hora de inicio del evento cuando el
// calendario la trae; si no, son una PROPUESTA (con aviso).

import { EVENT_CATEGORIES } from './eventNaming';

const DIAS = ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
const JS_DIA = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' };
const PREFIJO_ID = { martes: 'm', miercoles: 'mi', jueves: 'j', viernes: 'v', domingo: 'sl', lunes: 'sl' };
const NOMBRE_DIA = { martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo', lunes: 'Lunes' };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const [CAT_PREP, CAT_CARGA, CAT_LIMPIEZA] = ['Logística Preparación', 'Logística Carga', 'Limpieza Eventos'];

const MIN_INICIO = 6 * 60 + 30; // nadie empieza antes de las 06:30
const PENALIZACION_BACKUP = 6; // horas: el "backup" solo entra cuando los demás van cargados

// ─── Fechas ────────────────────────────────────────────────────────────────
const fechaLocal = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };

// Las semanas de Gula van de martes a domingo (+ el lunes de cola). Devuelve el
// martes que abre la semana en la que cae `fecha` (el lunes cuenta como cola de la anterior).
export function martesDeSemana(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const atras = (d.getDay() - 2 + 7) % 7; // martes = 2
  return sumarDias(d, -atras);
}

// "Del 22 al 27 de Septiembre de 2026" / "Del 29 de Septiembre al 4 de Octubre de 2026"
export function formatearRango(inicioMartes) {
  const fin = sumarDias(inicioMartes, 5);
  if (inicioMartes.getMonth() === fin.getMonth()) {
    return `Del ${inicioMartes.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]} de ${fin.getFullYear()}`;
  }
  return `Del ${inicioMartes.getDate()} de ${MESES[inicioMartes.getMonth()]} al ${fin.getDate()} de ${MESES[fin.getMonth()]} de ${fin.getFullYear()}`;
}

export const weekIdParaInicio = (inicioMartes) => `week_auto_${aIso(inicioMartes)}`;

// ─── Horas ─────────────────────────────────────────────────────────────────
const aMin = (hhmm) => Number(hhmm.slice(0, hhmm.indexOf(':'))) * 60 + Number(hhmm.slice(hhmm.indexOf(':') + 1));
const hhmm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const redondear = (min) => Math.round(min / 30) * 30; // a medias horas
const rango = (ini, fin) => `${hhmm(ini)} - ${hhmm(fin)}`;

// ─── Nombres ───────────────────────────────────────────────────────────────
const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const capitalizar = (s) => s.toLowerCase().replace(/(^|[\s(])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());

// "COFFE + COMIDA AITANA" -> "Evento Coffe + Comida Aitana"; "Boda Ana Y Luis" -> "Boda Ana y Luis"
export function nombreDeEvento(apunte) {
  // Se quitan los pax escritos en el título y las dudas del calendario: "(¿este día?)".
  let t = String(apunte.titulo || '').replace(/\([^)]*\?[^)]*\)/g, '').replace(/\b\d+\s*pax\b/gi, '').replace(/\s+/g, ' ').trim();
  if (t === t.toUpperCase() || t === t.toLowerCase()) t = capitalizar(t);
  t = t.replace(/\sY\s/g, ' y ');
  const prefijo = apunte.tipo === 'boda' ? 'Boda' : apunte.tipo === 'comunion' ? 'Comunión' : 'Evento';
  return /^(boda|evento|comuni[oó]n)\b/i.test(t) ? t : `${prefijo} ${t}`;
}

// ─── Lectura de los apuntes ────────────────────────────────────────────────
const TIPOS_EVENTO = ['boda', 'comunion', 'corporativo'];

function extraerEventos(apuntes, inicio, fin) {
  const dentro = (a) => a.fecha >= aIso(inicio) && a.fecha <= aIso(fin);
  const candidatos = apuntes.filter(a => TIPOS_EVENTO.includes(a.tipo) && dentro(a));

  // "DESCARGA ..." apuntada como boda: es una descarga de logística, no un evento.
  const descargas = candidatos.filter(a => /^descarga\b/i.test(a.titulo.trim()));
  const eventosBrutos = candidatos.filter(a => !/^descarga\b/i.test(a.titulo.trim()));

  // Duplicados: mismo día y un título es el principio del otro ("Boda Ana" / "Boda Ana Y Luis").
  const fusionados = [];
  for (const a of eventosBrutos) {
    const nombre = nombreDeEvento(a);
    const previo = fusionados.find(e => e.fecha === a.fecha && (plano(e.nombre).startsWith(plano(nombre)) || plano(nombre).startsWith(plano(e.nombre))));
    if (previo) {
      if (nombre.length > previo.nombre.length) previo.nombre = nombre;
      previo.pax = previo.pax ?? a.pax;
      previo.sitio = previo.sitio ?? a.sitio;
      previo.hora = previo.hora ?? a.hora;
    } else {
      fusionados.push({ nombre, tipo: a.tipo, fecha: a.fecha, pax: a.pax, sitio: a.sitio, hora: a.hora });
    }
  }
  // El mismo evento apuntado en dos días distintos ("¿este día?"): se queda uno solo
  // (el que trae lugar; si empatan, el último) y se AVISA para que se revise la fecha.
  const avisosFusion = [];
  const unicos = [];
  fusionados.forEach(e => {
    const clave = plano(e.nombre);
    const igual = unicos.find(u => plano(u.nombre) === clave && u.fecha !== e.fecha);
    if (!igual) { unicos.push(e); return; }
    const gana = (e.sitio && !igual.sitio) ? e : (!e.sitio && igual.sitio) ? igual : e;
    const pierde = gana === e ? igual : e;
    gana.pax = gana.pax ?? pierde.pax; gana.sitio = gana.sitio ?? pierde.sitio; gana.hora = gana.hora ?? pierde.hora;
    unicos.splice(unicos.indexOf(igual), 1, gana);
    avisosFusion.push(`${gana.nombre}: aparece apuntada en dos días (${pierde.fecha.slice(8)} y ${gana.fecha.slice(8)}); se ha usado el ${gana.fecha.slice(8)}, revisa la fecha.`);
  });
  return { eventos: unicos.sort((x, y) => x.fecha.localeCompare(y.fecha)), descargas, avisosFusion };
}

function extraerAlquileres(apuntes, inicio, fin) {
  // Los alquileres continuos ("Camión X" con `hasta`) son disponibilidad, no tareas.
  return apuntes
    .filter(a => a.tipo === 'recogida' && !a.hasta && a.fecha >= aIso(inicio) && a.fecha <= aIso(fin))
    .map(a => {
      const h = a.titulo.match(/(\d{1,2}):(\d{2})/);
      const esDevolucion = /devolv|devoluc/i.test(a.titulo);
      const limpio = a.titulo.replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/[,\s]+$/g, '').replace(/^\s*(?:a las\s*)?/i, '').trim();
      return { titulo: limpio, fecha: a.fecha, hora: h ? aMin(`${h[1]}:${h[2]}`) : null, esDevolucion };
    });
}

function extraerVacaciones(apuntes, roster) {
  // vacaciones: el título lleva el nombre de la persona; `hasta` marca el rango.
  const mapa = []; // { nombre, desde, hasta }
  apuntes.filter(a => a.tipo === 'vacaciones').forEach(a => {
    const t = plano(a.titulo);
    roster.forEach(p => { if (t.includes(plano(p.name))) mapa.push({ nombre: p.name, desde: a.fecha, hasta: a.hasta || a.fecha }); });
  });
  return mapa;
}

// ─── Equipo ────────────────────────────────────────────────────────────────
function clasificarEquipo(roster) {
  const pools = { conductores: [], apoyo: [], prep: [], supervisor: [], limpieza: [] };
  roster.forEach((p, i) => {
    const rol = plano(p.role);
    const entrada = { name: p.name, orden: i, backup: /backup/.test(rol) };
    if (/limpieza/.test(rol)) pools.limpieza.push(entrada);
    else if (/conductor/.test(rol)) pools.conductores.push(entrada);
    else if (/jefe/.test(rol)) pools.supervisor.push(entrada);
    else if (/prepara|checklist|ayudante/.test(rol)) pools.prep.push(entrada);
    else if (/apoyo/.test(rol)) pools.apoyo.push(entrada);
  });
  return pools;
}

// ─── Generador ─────────────────────────────────────────────────────────────
// { inicio: Date (martes), apuntes, roster: [{name, role}], plantilla: {team, trucks}, nombre }
export function generarBorrador({ inicio, apuntes = [], roster = [], plantilla = {}, nombre = 'Semana', ahora = new Date() }) {
  const inicioMartes = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fechas = {};
  DIAS.forEach((d, i) => { fechas[d] = sumarDias(inicioMartes, i); });
  const finSemana = fechas.lunes;

  const { eventos, descargas, avisosFusion } = extraerEventos(apuntes, inicioMartes, fechas.domingo);
  const alquileres = extraerAlquileres(apuntes, inicioMartes, finSemana);
  const vacaciones = extraerVacaciones(apuntes, roster);
  const pools = clasificarEquipo(roster);
  const avisos = [...avisosFusion];

  const diaDeFecha = (iso) => JS_DIA[fechaLocal(iso).getDay()];
  const camiones = (plantilla.trucks || []).map(t => t.name);

  // ── 1. Lista de tareas a colocar ──
  // t: { dia, ini, fin, accion, evento, n, pool, lugar, extra, tipoTarea }
  const tareas = [];
  const enSemana = (iso) => iso >= aIso(inicioMartes) && iso <= aIso(finSemana);
  const nueva = (t) => { tareas.push({ n: 1, lugar: 'Almacén Base', maps: '', ...t }); };
  const mapa = (lugar) => (lugar && lugar !== 'Almacén Base' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar).replace(/%20/g, '+')}` : '');

  const eventosPorDia = {};
  eventos.forEach(e => { (eventosPorDia[e.fecha] = eventosPorDia[e.fecha] || []).push(e); });

  eventos.forEach(e => {
    const dia = diaDeFecha(e.fecha);
    const idx = DIAS.indexOf(dia);
    const grande = (e.pax || 0) >= 150;
    const esBoda = e.tipo === 'boda';
    const sinHora = !e.hora;
    if (sinHora) avisos.push(`${e.nombre}: el calendario no trae la hora de inicio, horario propuesto.`);
    if (!e.pax) avisos.push(`${e.nombre}: sin pax en el calendario (los costes compartidos se repartirán a partes iguales).`);

    const H = e.hora ? aMin(e.hora) : (esBoda ? 18 * 60 + 30 : 12 * 60);
    const margen = esBoda ? 330 : 60; // minutos entre el fin del montaje y el inicio
    const durMontaje = esBoda ? 180 : (e.pax || 0) >= 100 ? 150 : 120;
    const lugar = e.sitio || 'Por confirmar';

    if (dia === 'sabado') {
      // Sábado: van en la lista de bodas (montaje final + recogida).
      nueva({ dia, ini: 7 * 60, fin: 12 * 60, evento: e.nombre, accion: 'Comida y montaje final', n: grande ? 4 : 3, pool: 'equipo', lugar, extra: { sabado: true, pax: e.pax } });
      nueva({ dia, ini: 20 * 60 + 30, fin: 24 * 60 + 30, evento: e.nombre, accion: 'Recogida del evento', n: grande ? 3 : 2, pool: 'conductores', lugar, extra: { sabado: true, pax: e.pax } });
      // Víspera: carga, descarga adelantada, y recogida del domingo.
      const vispera = idx - 1;
      const antevispera = idx - 2;
      const diaCarga = grande ? DIAS[antevispera] : DIAS[vispera];
      if (diaCarga && DIAS.indexOf(diaCarga) >= 0) {
        nueva({ dia: diaCarga, ini: grande ? 15 * 60 : 8 * 60, fin: grande ? 18 * 60 : 9 * 60 + 30, evento: e.nombre, accion: grande ? 'Carga de material (2 camiones)' : 'Carga de material', n: grande ? 3 : 2, pool: 'carga', lugar: 'Almacén Base' });
      }
      if ((e.pax || 0) >= 100 && DIAS[vispera]) {
        nueva({ dia: DIAS[vispera], ini: 10 * 60 + 30, fin: 16 * 60, evento: e.nombre, accion: 'Descarga adelantada de material y estructura', n: 2, pool: 'conductores', lugar });
      }
      nueva({ dia: 'domingo', ini: 10 * 60, fin: 14 * 60, evento: e.nombre, accion: 'Terminar de recoger en el sitio', n: (e.pax || 0) >= 100 ? 3 : 2, pool: 'conductores', lugar, extra: { targetDay: 'Domingo' } });
      return;
    }

    // Evento de un día de diario (martes-viernes) o domingo/lunes.
    const mFin = H - margen;
    let mIni = mFin - durMontaje;
    let cargaIni;
    let cargaFin;
    let cargaDia = dia;
    if (mIni < MIN_INICIO) {
      // Empieza tan pronto que no cabe montar y cargar por la mañana: la carga va la víspera.
      mIni = Math.max(MIN_INICIO, mFin - durMontaje);
      if (mFin - mIni < 60) { mIni = MIN_INICIO; }
      const vispera = DIAS[idx - 1];
      if (vispera && idx > 0) {
        cargaDia = vispera; cargaIni = 16 * 60; cargaFin = 17 * 60 + 30;
      } else {
        avisos.push(`${e.nombre}: empieza a las ${hhmm(H)}, hay que cargar el día anterior (cae en la semana anterior).`);
        cargaDia = null;
      }
    } else {
      cargaIni = mIni - 90; cargaFin = mIni - 30;
      if (cargaIni < MIN_INICIO) { const d = MIN_INICIO - cargaIni; cargaIni += d; cargaFin += d; mIni += d; }
    }
    const mFinReal = Math.max(mIni + 60, mFin);

    if (cargaDia) nueva({ dia: cargaDia, ini: redondear(cargaIni), fin: redondear(cargaFin), evento: e.nombre, accion: 'Carga de material', n: 2, pool: 'carga', lugar: 'Almacén Base' });
    nueva({ dia, ini: redondear(mIni), fin: redondear(mFinReal), evento: e.nombre, accion: 'Descarga + Montaje Estructura', n: 2, pool: 'carga', lugar });
    if (esBoda || (e.pax || 0) >= 50) nueva({ dia, ini: redondear(mIni), fin: redondear(esBoda ? H : H + 120), evento: e.nombre, accion: 'Supervisión', n: 1, pool: 'supervisor', lugar });
    const rIni = esBoda ? H + 240 : H + 210;
    const rFin = esBoda ? H + 360 : H + 300;
    nueva({ dia, ini: redondear(rIni), fin: redondear(rFin), evento: e.nombre, accion: 'Recogida y vuelta a base', n: esBoda ? 2 : 1, pool: 'conductores', lugar });
  });

  // ── Descargas apuntadas como "boda": descarga adelantada de la boda más cercana ──
  descargas.forEach(a => {
    const dia = diaDeFecha(a.fecha);
    // Las descargas adelantadas son de bodas grandes: entre las bodas de los 3 días
    // siguientes se prefiere la más cercana con 100 pax o más; si no, la más cercana.
    const cercanas = eventos.filter(e => e.tipo === 'boda' && e.fecha >= a.fecha && (fechaLocal(e.fecha) - fechaLocal(a.fecha)) <= 3 * 86400000);
    const siguiente = cercanas.find(e => (e.pax || 0) >= 100) || cercanas[0];
    const detalle = a.titulo.replace(/^descarga\s*/i, '').trim();
    nueva({
      dia, ini: 10 * 60, fin: 13 * 60, n: 2, pool: 'conductores', lugar: detalle ? capitalizar(detalle) : 'Por confirmar',
      evento: siguiente ? siguiente.nombre : CAT_PREP,
      accion: `Descarga adelantada${detalle ? ` (${capitalizar(detalle)})` : ''}`,
    });
  });

  // ── Preparación y limpieza de la semana (si hay eventos de jueves en adelante o sábado) ──
  const eventosGrandes = eventos.filter(e => DIAS.indexOf(diaDeFecha(e.fecha)) >= DIAS.indexOf('jueves'));
  if (eventosGrandes.length > 0) {
    const nombres = eventosGrandes.map(e => e.nombre).join(' + ');
    nueva({ dia: 'miercoles', ini: 9 * 60, fin: 15 * 60, evento: nombres, accion: 'Preparación y organización de material (checklist)', n: 3, pool: 'prepEquipo', lugar: 'Almacén Base' });
    nueva({ dia: 'miercoles', ini: 9 * 60, fin: 15 * 60, evento: CAT_LIMPIEZA, accion: 'Limpieza y empaquetado de vajilla y utensilios para los eventos', n: 2, pool: 'limpieza', lugar: 'Almacén Base' });
  }
  // Limpieza tras cada evento de diario. Si las recogidas acaban de madrugada (bodas de
  // tarde-noche) se limpia a la mañana siguiente; si esa mañana es sábado, el domingo.
  let limpiezaDomingo = eventos.some(e => diaDeFecha(e.fecha) === 'sabado');
  Object.entries(eventosPorDia).forEach(([iso, lista]) => {
    const dia = diaDeFecha(iso);
    if (['sabado', 'domingo', 'lunes'].includes(dia)) return;
    const recogidas = tareas.filter(t => t.dia === dia && t.accion === 'Recogida y vuelta a base');
    const fin = recogidas.length ? Math.max(...recogidas.map(t => t.fin)) : 16 * 60;
    const detalle = `(${lista.map(e => e.nombre.replace(/^(Evento|Boda|Comunión)\s+/i, '')).join(' y ')})`;
    const accion = `Limpieza de vajilla y utensilios ${detalle}`;
    if (fin <= 22 * 60) {
      nueva({ dia, ini: redondear(fin + 30), fin: redondear(fin + 210), evento: CAT_LIMPIEZA, accion, n: 2, pool: 'limpieza' });
    } else {
      const siguiente = DIAS[DIAS.indexOf(dia) + 1];
      if (siguiente && siguiente !== 'sabado') nueva({ dia: siguiente, ini: 9 * 60, fin: 12 * 60, evento: CAT_LIMPIEZA, accion, n: 2, pool: 'limpieza' });
      else limpiezaDomingo = true;
    }
  });
  if (limpiezaDomingo) {
    nueva({ dia: 'domingo', ini: 9 * 60, fin: 15 * 60, evento: CAT_LIMPIEZA, accion: 'Limpieza de vajilla y utensilios', n: 2, pool: 'limpieza', extra: { targetDay: 'Domingo' } });
  }

  // ── Alquileres: recogidas y devoluciones (una persona, por la mañana salvo hora) ──
  alquileres.forEach(r => {
    const dia = diaDeFecha(r.fecha);
    const ini = r.hora ?? 9 * 60;
    nueva({
      dia, ini, fin: ini + (r.hora ? 60 : 60), evento: CAT_PREP, accion: r.titulo || (r.esDevolucion ? 'Devolución de alquiler' : 'Recogida de alquiler'),
      n: 1, pool: 'conductores', lugar: 'Por confirmar', extra: dia === 'lunes' ? { targetDay: 'Lunes' } : dia === 'domingo' ? { targetDay: 'Domingo' } : {},
    });
  });
  // La devolución tras un evento: si hay alquiler recogido esta semana y no hay devolución apuntada, se avisa.
  if (alquileres.some(r => !r.esDevolucion) && !alquileres.some(r => r.esDevolucion)) {
    avisos.push('Hay recogidas de alquiler esta semana pero ninguna devolución apuntada en el calendario: revisa cuándo hay que devolverlo.');
  }

  // ── 2. Asignación de personas ──
  const ocupacion = {}; // 'dia|nombre' -> [[ini, fin]]
  const horas = {};
  roster.forEach(p => { horas[p.name] = 0; });
  const libre = (persona, dia, ini, fin) => {
    const iso = aIso(fechas[dia]);
    if (vacaciones.some(v => v.nombre === persona && iso >= v.desde && iso <= v.hasta)) return false;
    return !(ocupacion[`${dia}|${persona}`] || []).some(([a, b]) => ini < b && a < fin);
  };
  const candidatos = (pool) => {
    if (pool === 'prepEquipo') return [...pools.prep, ...pools.supervisor, ...pools.apoyo];
    if (pool === 'carga') return [...pools.conductores, ...pools.apoyo];
    if (pool === 'equipo') return [...pools.conductores, ...pools.apoyo, ...pools.supervisor];
    return pools[pool] || [];
  };

  tareas.sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.ini - b.ini);
  const colocadas = tareas.map(t => {
    const finReal = t.fin <= t.ini ? t.fin + 1440 : t.fin;
    const durH = (finReal - t.ini) / 60;
    const elegibles = candidatos(t.pool)
      .filter(p => libre(p.name, t.dia, t.ini, finReal))
      .sort((x, y) => (horas[x.name] + (x.backup ? PENALIZACION_BACKUP : 0)) - (horas[y.name] + (y.backup ? PENALIZACION_BACKUP : 0)) || x.orden - y.orden);
    const elegidos = elegibles.slice(0, t.n);
    if (elegidos.length < t.n) avisos.push(`${NOMBRE_DIA[t.dia]}: ${t.evento} - ${t.accion}: solo ${elegidos.length} de ${t.n} personas libres (vacaciones o solapes).`);
    elegidos.forEach(p => {
      (ocupacion[`${t.dia}|${p.name}`] = ocupacion[`${t.dia}|${p.name}`] || []).push([t.ini, finReal]);
      horas[p.name] += durH;
    });
    return { ...t, assigned: elegidos.map(p => p.name) };
  });

  // ── 3. Montaje del objeto semana ──
  const escribirTexto = (t) => `${t.evento} - ${t.accion}`;
  const schedule = {};
  ['martes', 'miercoles', 'jueves', 'viernes'].forEach(d => { schedule[d] = { title: `${NOMBRE_DIA[d]} ${fechas[d].getDate()}`, badge: '', tasks: [] }; });
  const weddings = [];
  const compartidas = [];
  const trucksTexto = camiones.length >= 2 ? `${camiones[1]} + ${camiones[0]}` : (camiones[0] || 'Camión');

  colocadas.forEach(t => {
    if (t.extra?.sabado || t.dia === 'sabado') {
      weddings.push({
        location: t.lugar, truck: trucksTexto, details: `${t.evento} — ${t.accion}${t.extra?.pax ? ` (${t.extra.pax} pax)` : ''}`,
        timeFrame: rango(t.ini, t.fin), mapsUrl: mapa(t.lugar), assigned: t.assigned, completed: false, event: t.evento, _ini: t.ini,
      });
      return;
    }
    const base = { text: escribirTexto(t), location: t.lugar, timeFrame: rango(t.ini, t.fin), mapsUrl: mapa(t.lugar), assigned: t.assigned, completed: false, event: t.evento };
    if (t.dia === 'domingo' || t.dia === 'lunes') compartidas.push({ ...base, targetDay: t.extra?.targetDay || (t.dia === 'lunes' ? 'Lunes' : 'Domingo'), _dia: t.dia, _ini: t.ini });
    else if (schedule[t.dia]) schedule[t.dia].tasks.push({ ...base, _ini: t.ini });
  });

  // IDs por día y limpieza de campos internos
  Object.entries(schedule).forEach(([dia, d]) => {
    d.tasks.sort((a, b) => a._ini - b._ini);
    d.tasks = d.tasks.map((t, i) => { const { _ini, ...resto } = t; return { id: `${PREFIJO_ID[dia]}${i + 1}`, ...resto }; });
    const evs = [...new Set(d.tasks.map(t => t.event).filter(e => !EVENT_CATEGORIES.includes(e)))];
    d.badge = evs.length ? evs.map(e => e.replace(/^(Evento|Boda|Comunión)\s+/i, '')).join(' & ').slice(0, 60) : 'Preparación & Carga';
  });
  weddings.sort((a, b) => a._ini - b._ini);
  const bodasFinal = weddings.map(({ _ini, ...w }) => w);
  compartidas.sort((a, b) => DIAS.indexOf(a._dia) - DIAS.indexOf(b._dia) || a._ini - b._ini);
  const sundayMonday = compartidas.map(({ _dia, _ini, ...t }, i) => ({ id: `sl${i + 1}`, ...t }));

  const evSabado = eventos.filter(e => diaDeFecha(e.fecha) === 'sabado');
  const semana = {
    name: nombre,
    meta: {
      week: nombre,
      dateRange: formatearRango(inicioMartes),
      status: 'Borrador',
      generadoDesde: 'calendario',
      generadoEl: ahora.toISOString(),
      avisos: [...new Set(avisos)],
    },
    team: (plantilla.team || []).map(t => ({ ...t })),
    trucks: (plantilla.trucks || []).map(t => ({ ...t, pickupCompleted: false, returnCompleted: false })),
    events: eventos.filter(e => e.pax).map(e => ({ name: e.nombre, pax: e.pax })),
    schedule,
    saturdaySpecial: {
      title: evSabado.length ? `Sábado ${fechas.sabado.getDate()} — ${evSabado.map(e => e.nombre).join(' + ')}${evSabado[0].pax ? ` (${evSabado.reduce((a, e) => a + (e.pax || 0), 0)} pax)` : ''}` : `Sábado ${fechas.sabado.getDate()}`,
      weddings: bodasFinal,
    },
    sundayMonday: {
      title: `Domingo ${fechas.domingo.getDate()} & Lunes ${fechas.lunes.getDate()} — Logística Inversa y Limpieza`,
      tasks: sundayMonday,
    },
  };

  const resumen = {
    eventos: eventos.length,
    alquileres: alquileres.length,
    descargas: descargas.length,
    tareas: Object.values(schedule).reduce((a, d) => a + d.tasks.length, 0) + bodasFinal.length + sundayMonday.length,
    avisos: semana.meta.avisos,
    horasPorPersona: horas,
  };
  return { week: semana, resumen };
}
