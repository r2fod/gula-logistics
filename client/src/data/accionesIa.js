// El asistente fuera del cuadrante. Lo que se le pide sobre el resto de la app («Ana cobra
// 12 € la hora desde el día 4», «apunta 10 € de transporte a Luis del lunes», «el 8 de
// diciembre es festivo», «Eva nunca puede los lunes») se convierte en ACCIONES de un
// catálogo cerrado. Gemini (o la app sola, si lo entiende) solo las propone: cada una se
// comprueba aquí (validarAccion), se enseña con su efecto exacto y se aplica cuando el admin
// dice que sí (aplicarAcciones), con las mismas piezas que los botones de la app.
import { pedirJsonAGemini } from './geminiScheduleService';
import { fetchBalancesFromAPI, saveWorkerBalanceToAPI } from './apiService';
import { festivoEn, festivosLocales } from './festivos';
import { guardarFestivosLocales } from './festivosGuardados';
import { fichajesACambiarDeTarifa, tarifaDe, tarifaEnFichaDeSaldos, transporteDia } from './tarifas';
import { fichaDeSaldosNueva } from './saldosEquipo';
import { saldoDeApuntes } from './conceptosSaldos';
import { fichaDePersona, mismoNombre } from './nombresTrabajadores';
import { DIAS_SEMANA, OPCIONES_DIA, restriccionesDeFormulario, textosFijos, TIPOS_DISPONIBILIDAD } from './disponibilidad';
import { interpretarDisponibilidad } from './interpretarPeticion';
import { aIso, fechaLocal } from './fechasSemana';
import { getDayLabel } from './taskPlanning';
import { formatearEuros, formatearEurosConSigno } from './formatoFinanciero';
import { formatDayMonthShort, formatWeekdayDayMonth } from '../utils/dateUtils';
import { plano } from '../utils/texto';

export const TIPOS_ACCION = ['tarifa', 'apunte', 'festivo', 'disponibilidad'];
const CLASES_APUNTE = { transporte: 'Transporte', pago: 'Pago', ajuste: 'Ajuste' };
const DIAS_FIJA = OPCIONES_DIA.map(o => o.valor);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;
const fechaValida = (f) => FECHA.test(String(f || '')) && !Number.isNaN(fechaLocal(f).getTime());
const diaCorto = (iso) => formatDayMonthShort(fechaLocal(iso));
const redondear = (n) => Math.round(Number(n) * 100) / 100;
// Una escritura o lectura que nunca lanza: lo que devuelva, o false/null si falla.
const intentar = async (hacer) => { try { return !!(await hacer()); } catch { return false; } };
const leerSinFallo = async (leer) => { try { return await leer(); } catch { return null; } };


// ¿Pide algo de la app que no es el cuadrante? (tarifa, un apunte en Saldos, un festivo)
const PIDE_TARIFA = /\btarifa\b|\bcobra(r|n)?\b|\d\s*(€|euros?)\s*(\/|la|por|a la)\s*h(ora)?\b/;
const PIDE_APUNTE = /\b(apunta(le)?|anota(le)?|registra|suma(le)|resta(le)|descuenta(le)?|abona(le)?)\b|\b(le|les) (he|hemos|han) (pagado|dado|adelantado)\b|\b(adelanto|efectivo|bizum)\b/;
const PIDE_FESTIVO = /\bfestiv[oa]s?\b|\b(es|sera|hay) fiesta\b|\bdia de fiesta\b/; // «la fiesta de Marta» es un evento
export const pideAccionDeApp = (peticion) => {
  const p = plano(peticion);
  return PIDE_TARIFA.test(p) || PIDE_APUNTE.test(p) || PIDE_FESTIVO.test(p);
};

// «Eva nunca puede los lunes», «Ana siempre descansa los domingos»: disponibilidad FIJA (su
// ficha del equipo, todas las semanas), entendida sin Gemini. null si no suena a fija o no
// se entiende (entonces sigue el camino de siempre).
const SUENA_FIJA = /\b(siempre|nunca|todas las semanas|cada semana|de normal|normalmente|por norma|a partir de ahora|de ahora en adelante)\b/;
export function accionesDeDisponibilidadFija(peticion, equipo = []) {
  const p = plano(peticion);
  if (!SUENA_FIJA.test(p)) return null;
  const texto = p.replace(/\bnunca (puede|pueden|trabaja|trabajan|viene|vienen|esta|estan)\b/g, 'no $1');
  const restricciones = interpretarDisponibilidad(texto, equipo);
  if (!restricciones) return null;
  return restricciones.map(r => ({ tipo: 'disponibilidad', persona: r.persona, dia: r.dia, disponibilidad: r.tipo, horaDesde: r.desde || '', horaHasta: r.hasta || '' }));
}

// Forma obligatoria de lo que devuelve Gemini (responseSchema): solo estas acciones y
// solo gente del equipo.
export function esquemaAcciones(nombres = []) {
  const TEXTO = { type: 'STRING' };
  return {
    type: 'OBJECT',
    properties: {
      acciones: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tipo: { type: 'STRING', format: 'enum', enum: TIPOS_ACCION },
            persona: nombres.length ? { type: 'STRING', format: 'enum', enum: nombres } : TEXTO,
            tarifa: { type: 'NUMBER' },
            desde: { type: 'STRING', description: 'AAAA-MM-DD' },
            clase: { type: 'STRING', format: 'enum', enum: Object.keys(CLASES_APUNTE) },
            importe: { type: 'NUMBER' },
            concepto: TEXTO,
            fecha: { type: 'STRING', description: 'AAAA-MM-DD' },
            operacion: { type: 'STRING', format: 'enum', enum: ['anadir', 'quitar'] },
            nombre: TEXTO,
            dia: { type: 'STRING', format: 'enum', enum: DIAS_FIJA },
            disponibilidad: { type: 'STRING', format: 'enum', enum: Object.keys(TIPOS_DISPONIBILIDAD) },
            horaDesde: { type: 'STRING', description: 'HH:MM' },
            horaHasta: { type: 'STRING', description: 'HH:MM' },
          },
          required: ['tipo'],
          propertyOrdering: ['tipo', 'persona', 'tarifa', 'desde', 'clase', 'importe', 'concepto', 'fecha', 'operacion', 'nombre', 'dia', 'disponibilidad', 'horaDesde', 'horaHasta'],
        },
      },
      aclaracion: TEXTO,
    },
    required: ['acciones'],
  };
}

// Lo que se le manda: hoy y la semana abierta (para «el lunes», «ayer»), el equipo por su
// nombre (nada de tarifas ni saldos: no le hacen falta) y el catálogo.
export function promptDeAcciones({ peticion, equipo = [], semana = null, ahora = new Date() }) {
  const dias = semana?.meta?.dateRange ? ` Semana abierta: ${semana.meta.dateRange} (${DIAS_SEMANA.map(d => getDayLabel(semana, d, ahora)).join(', ')}).` : '';
  return [
    `Asistente de Gula Logística. Hoy es ${formatWeekdayDayMonth(ahora)} de ${ahora.getFullYear()} (${aIso(ahora)}).${dias}`,
    `Equipo: ${equipo.map(w => w.name).join(', ')}.`,
    'Convierte la petición en acciones de la app. Solo existen estas:',
    '- tarifa: lo que cobra por hora una persona. persona, tarifa (€/h) y, solo si dice desde qué día cambian también sus fichajes ya hechos, desde (AAAA-MM-DD).',
    '- apunte: en el saldo de una persona. clase: transporte (ayuda de transporte de un día; el importe puede ir vacío y se pone el de siempre), pago (dinero ya entregado: efectivo, Bizum, adelanto) o ajuste (plus, rotura, saldo inicial; importe negativo si resta). importe (€), concepto corto, fecha (AAAA-MM-DD del día al que corresponde; si no lo dice, hoy). Un apunte por día.',
    '- festivo: operacion anadir o quitar, fecha (AAAA-MM-DD) y nombre.',
    '- disponibilidad: FIJA, para todas las semanas. persona, dia (semana, entresemana, finde o martes…lunes), disponibilidad (no, descansa o solo) y, con solo, horaDesde/horaHasta (HH:MM).',
    'Fechas reales, calculadas desde hoy. No inventes importes, tarifas ni fechas que la petición no diga: si falta algo, no pongas esa acción y di qué falta en "aclaracion". Si no pide nada de esto, devuelve la lista vacía.',
    `Petición: ${peticion}`,
  ].join('\n');
}

// → { acciones (sin comprobar), aclaracion, uso }. Lanza si Gemini falla.
export async function pedirAcciones({ peticion, apiKey, equipo = [], semana = null, ahora = new Date() }) {
  const { json, uso } = await pedirJsonAGemini({
    apiKey,
    texto: promptDeAcciones({ peticion, equipo, semana, ahora }),
    esquema: esquemaAcciones(equipo.map(w => w.name)),
    temperatura: 0.1,
    extras: { thinkingConfig: { thinkingBudget: 512 } },
  });
  return { acciones: Array.isArray(json?.acciones) ? json.acciones : [], aclaracion: String(json?.aclaracion || '').trim(), uso };
}


// Comprueba una acción y prepara lo que hace falta para aplicarla y enseñarla:
// → { tipo, ok, texto (su efecto, para la tarjeta), aviso?, error?, …lo que usa aplicarAcciones }.
// `fichajes` (para la tarifa «desde»), `festivos` locales y `ahora`.
export function validarAccion(a = {}, { equipo = [], fichajes = [], festivos = festivosLocales(), ahora = new Date() } = {}) {
  const hoy = aIso(ahora);
  const persona = equipo.find(w => mismoNombre(w.name, a.persona));
  const quien = persona?.name || a.persona || 'alguien';
  const fallo = (texto, error) => ({ tipo: a.tipo, ok: false, texto, error });

  if (a.tipo === 'tarifa') {
    const tarifa = redondear(a.tarifa);
    const texto = `Tarifa de ${quien}: ${tarifa > 0 ? `${formatearEuros(tarifa)}/h` : '¿?'}`;
    if (!persona) return fallo(texto, 'No es nadie del equipo.');
    if (!(tarifa > 0 && tarifa <= 100)) return fallo(texto, 'La tarifa tiene que estar entre 0 y 100 €/h.');
    const desde = a.desde ? String(a.desde) : '';
    if (desde && (!fechaValida(desde) || desde > hoy)) return fallo(texto, 'El día «desde» no es válido (tiene que ser hoy o antes).');
    const antes = tarifaDe(persona);
    const cambian = desde ? fichajesACambiarDeTarifa(fichajes, persona.name, desde, tarifa).map(f => f.id) : [];
    const deFichajes = desde ? ` y ${cambian.length} ${cambian.length === 1 ? 'fichaje' : 'fichajes'} desde el ${diaCorto(desde)}` : ' (sus fichajes nuevos)';
    return {
      tipo: 'tarifa', ok: true, persona: persona.name, tarifa, antes, desde, fichajes: cambian,
      texto: `Tarifa de ${persona.name}: ${antes > 0 ? `${formatearEuros(antes)}/h` : 'sin tarifa'} → ${formatearEuros(tarifa)}/h${deFichajes}`,
      aviso: antes === tarifa && !cambian.length ? 'Ya tiene esa tarifa: no cambia nada.' : '',
    };
  }

  if (a.tipo === 'apunte') {
    const clase = CLASES_APUNTE[a.clase] ? a.clase : null;
    let importe = Number(a.importe);
    if (clase === 'transporte' && !(importe > 0)) importe = Number(transporteDia()) || NaN;
    const amount = redondear(clase === 'pago' ? -Math.abs(importe) : clase === 'transporte' ? Math.abs(importe) : importe);
    const concept = String(a.concepto || '').trim().slice(0, 80) || CLASES_APUNTE[clase] || 'Apunte';
    const fecha = a.fecha ? String(a.fecha) : hoy;
    const texto = `Saldos de ${quien}: ${Number.isFinite(amount) && amount ? formatearEurosConSigno(amount) : '¿?'} «${concept}»${fechaValida(fecha) ? ` · ${diaCorto(fecha)}` : ''}`;
    if (!persona) return fallo(texto, 'No es nadie del equipo.');
    if (!clase) return fallo(texto, 'Falta si es transporte, un pago o un ajuste.');
    if (!Number.isFinite(amount) || !amount || Math.abs(amount) > 5000) return fallo(texto, clase === 'transporte' ? 'Falta el importe (no hay ayuda de transporte por defecto).' : 'Falta el importe.');
    if (!fechaValida(fecha)) return fallo(texto, 'La fecha no es válida.');
    if (fecha > hoy) return fallo(texto, 'Es de un día que aún no ha llegado.');
    return {
      tipo: 'apunte', ok: true, persona: persona.name, texto,
      item: { concept, amount, isPositive: amount >= 0, tipo: clase, date: fecha },
    };
  }

  if (a.tipo === 'festivo') {
    const fecha = String(a.fecha || '');
    const operacion = a.operacion === 'quitar' ? 'quitar' : 'anadir';
    const nombre = String(a.nombre || '').trim().slice(0, 60) || 'Festivo local';
    const cuando = fechaValida(fecha) ? formatWeekdayDayMonth(fechaLocal(fecha)) : '¿?';
    const texto = operacion === 'quitar' ? `Quitar el festivo local del ${cuando}` : `Festivo local: ${cuando} «${nombre}»`;
    if (!fechaValida(fecha)) return fallo(texto, 'Falta la fecha.');
    const ya = festivoEn(fecha, festivos);
    if (operacion === 'anadir' && ya) return fallo(texto, `Ya es festivo: ${ya.nombre}.`);
    if (operacion === 'quitar' && !ya?.local) return fallo(texto, ya ? `${ya.nombre} es un festivo oficial: no se puede quitar.` : 'Ese día no hay ningún festivo local.');
    return { tipo: 'festivo', ok: true, operacion, fecha, nombre, texto };
  }

  if (a.tipo === 'disponibilidad') {
    const dia = DIAS_FIJA.includes(a.dia) ? a.dia : null;
    const tipo = TIPOS_DISPONIBILIDAD[a.disponibilidad] ? a.disponibilidad : null;
    const desde = HORA.test(a.horaDesde || '') ? a.horaDesde : '';
    const hasta = HORA.test(a.horaHasta || '') ? a.horaHasta : '';
    const texto = `Disponibilidad fija de ${quien}`;
    if (!persona) return fallo(texto, 'No es nadie del equipo.');
    if (!dia || !tipo) return fallo(texto, 'Falta qué día o qué pasa ese día.');
    const { restricciones, error } = restriccionesDeFormulario({ persona: persona.name, dia, tipo, desde, hasta });
    if (error) return fallo(texto, error);
    const nuevas = restricciones.map(({ dia: d, tipo: t, desde: de = '', hasta: ha = '' }) => ({ dia: d, tipo: t, desde: de, hasta: ha }));
    const dias = new Set(nuevas.map(r => r.dia));
    const sustituye = (Array.isArray(persona.disponibilidad) ? persona.disponibilidad : []).filter(r => dias.has(r.dia));
    return {
      tipo: 'disponibilidad', ok: true, persona: persona.name, nuevas,
      texto: `Disponibilidad fija de ${persona.name}: ${textosFijos(nuevas, persona.name).join('; ')}`,
      aviso: sustituye.length ? `Sustituye lo que tenía: ${textosFijos(sustituye, persona.name).join('; ')}.` : '',
    };
  }

  return fallo('Algo que la app no sabe hacer', 'El asistente solo puede cambiar tarifas, apuntes en Saldos, festivos y disponibilidad fija.');
}

// Aplica las acciones ya comprobadas (y elegidas por el admin) → [{ ok, error }] en el mismo
// orden. Lo de cada sitio va junto: las fichas del equipo en un solo guardado, en Saldos un
// guardado por persona sobre lo que hay AHORA en el servidor (leído justo antes, para no
// pisar nada) y los festivos en uno. Las piezas de React llegan en `ctx`:
//   guardarFichas({ nombre: cambios }) → bool, cambiarTarifaFichajes(ids, tarifa) → bool,
//   usarSaldos(datos) (la copia en pantalla). El resto tiene su valor de siempre.
export async function aplicarAcciones(acciones = [], {
  equipo = [], guardarFichas, cambiarTarifaFichajes, usarSaldos = () => {},
  leerSaldos = () => fetchBalancesFromAPI({ soloServidor: true }), guardarSaldo = saveWorkerBalanceToAPI,
  festivos = festivosLocales(), guardarFestivos = guardarFestivosLocales,
} = {}) {
  const resultado = acciones.map(() => ({ ok: false, error: '' }));
  const de = (tipo) => acciones.map((a, i) => (a?.ok && a.tipo === tipo ? i : -1)).filter(i => i >= 0);
  const marcar = (indices, ok, error) => indices.forEach(i => { resultado[i] = ok ? { ok: true, error: '' } : { ok: false, error }; });

  // 1. Fichas del equipo: tarifa y disponibilidad fija.
  const delEquipo = [...de('tarifa'), ...de('disponibilidad')];
  if (delEquipo.length) {
    const cambios = {};
    delEquipo.forEach(i => {
      const a = acciones[i];
      const previo = cambios[a.persona] || {};
      if (a.tipo === 'tarifa') { cambios[a.persona] = { ...previo, rate: a.tarifa }; return; }
      const actual = previo.disponibilidad || equipo.find(w => w.name === a.persona)?.disponibilidad || [];
      const dias = new Set(a.nuevas.map(r => r.dia));
      cambios[a.persona] = { ...previo, disponibilidad: [...actual.filter(r => !dias.has(r.dia)), ...a.nuevas] };
    });
    const ok = await intentar(() => guardarFichas(cambios));
    marcar(delEquipo, ok, 'No se pudo guardar la ficha: vuelve a iniciar sesión de administrador y repítelo.');
    if (ok) {
      for (const i of de('tarifa')) {
        const a = acciones[i];
        if (!a.fichajes?.length) continue;
        if (!(await intentar(() => cambiarTarifaFichajes(a.fichajes, a.tarifa)))) resultado[i] = { ok: false, error: 'La tarifa se guardó, pero no todos sus fichajes: pídelo otra vez.' };
      }
    }
  }

  // 2. Saldos: los apuntes y, si cambió, la tarifa en su ficha de Saldos.
  const apuntes = de('apunte');
  const tarifas = de('tarifa').filter(i => resultado[i].ok && acciones[i].tarifa !== acciones[i].antes);
  if (apuntes.length || tarifas.length) {
    const datos = await leerSinFallo(leerSaldos);
    const fichas = Array.isArray(datos?.workers) ? datos.workers : [];
    // Sin los saldos de verdad no se escribe: un apunte sobre una copia vacía borraría los demás.
    if (!fichas.length) marcar(apuntes, false, 'No se pudieron leer los saldos: vuelve a iniciar sesión de administrador y repítelo.');
    else {
      const nombres = equipo.map(w => w.name);
      const porPersona = new Map();
      [...apuntes, ...tarifas].forEach(i => porPersona.set(acciones[i].persona, [...(porPersona.get(acciones[i].persona) || []), i]));
      for (const [nombre, indices] of porPersona) {
        const suyosApuntes = indices.filter(i => acciones[i].tipo === 'apunte');
        const tarifa = indices.map(i => acciones[i]).find(a => a.tipo === 'tarifa');
        const nueva = fichaDeSaldosNueva(equipo.find(w => w.name === nombre) || { name: nombre });
        const ficha = fichaDePersona(nombre, fichas, nombres) || fichas.find(f => f.id === nueva.id) || null;
        if (!ficha && !suyosApuntes.length) continue; // la tarifa no tiene ficha de Saldos donde ir
        const base = ficha || nueva;
        const breakdown = [...(base.breakdown || []), ...suyosApuntes.map(i => acciones[i].item)];
        const cambiosSaldo = {
          ...(ficha ? {} : base),
          ...(suyosApuntes.length ? { breakdown, currentBalance: saldoDeApuntes(breakdown) } : {}),
          ...(tarifa ? tarifaEnFichaDeSaldos(base, tarifa.tarifa) : {}),
        };
        const ok = await intentar(() => guardarSaldo(base.id, cambiosSaldo));
        marcar(suyosApuntes, ok, 'No se pudo guardar en Saldos: vuelve a iniciar sesión de administrador y repítelo.');
      }
      const frescos = await leerSinFallo(leerSaldos); // si no, la pantalla se pone al día en el siguiente refresco
      if (frescos?.workers?.length) usarSaldos(frescos);
    }
  }

  // 3. Festivos locales: la lista entera, en un guardado.
  const deFestivos = de('festivo');
  if (deFestivos.length) {
    let lista = [...festivos];
    deFestivos.forEach(i => {
      const a = acciones[i];
      lista = lista.filter(f => f.fecha !== a.fecha);
      if (a.operacion === 'anadir') lista.push({ fecha: a.fecha, nombre: a.nombre });
    });
    const ok = await intentar(() => guardarFestivos(lista));
    marcar(deFestivos, ok, 'No se pudo guardar el festivo: vuelve a iniciar sesión de administrador y repítelo.');
  }

  return resultado;
}
