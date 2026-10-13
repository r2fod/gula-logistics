// Días festivos de la zona (Comunitat Valenciana): ese día cierran los proveedores y las
// empresas de alquiler, así que una recogida o una devolución no se puede hacer.
//
// Los nacionales y autonómicos salen por regla: los de fecha fija, Viernes Santo y Lunes
// de Pascua, sin los que caen en domingo (la Generalitat no los traslada: en 2026 no hay
// Todos los Santos ni Constitución). Coincide con los decretos de 2026 (Decreto 100/2025,
// DOGV 07/07/2025, que además trae San Juan) y de 2027; los años siguientes son una
// previsión hasta que salga su decreto (`previsto`). Los dos locales de cada municipio
// los añade el admin (Configuración → Festivos): `usarFestivosLocales`.
import { aIso, fechaLocal, sumarDias } from './fechasSemana';

const FIJOS = [
  ['01-01', 'Año Nuevo'],
  ['01-06', 'Epifanía del Señor'],
  ['03-19', 'San José'], // privacidad-ok: es el nombre del festivo
  ['05-01', 'Fiesta del Trabajo'],
  ['08-15', 'Asunción de la Virgen'],
  ['10-09', 'Día de la Comunitat Valenciana'],
  ['10-12', 'Fiesta Nacional de España'],
  ['11-01', 'Todos los Santos'],
  ['12-06', 'Día de la Constitución'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-25', 'Natividad del Señor'],
];
// Los que el decreto de un año añade a la regla.
const SOLO_ESE_ANO = { 2026: [['06-24', 'San Juan']] };
const ULTIMO_ANO_OFICIAL = 2027;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Domingo de Pascua (calendario gregoriano).
function domingoDePascua(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(ano, Math.floor(n / 31) - 1, (n % 31) + 1);
}

// Festivos nacionales y autonómicos de un año: [{ fecha 'AAAA-MM-DD', nombre, previsto }], por fecha.
export function festivosDelAno(ano) {
  const pascua = domingoDePascua(ano);
  const previsto = ano > ULTIMO_ANO_OFICIAL;
  return [
    ...FIJOS.map(([dia, nombre]) => ({ fecha: `${ano}-${dia}`, nombre })),
    ...(SOLO_ESE_ANO[ano] || []).map(([dia, nombre]) => ({ fecha: `${ano}-${dia}`, nombre })),
    { fecha: aIso(sumarDias(pascua, -2)), nombre: 'Viernes Santo' },
    { fecha: aIso(sumarDias(pascua, 1)), nombre: 'Lunes de Pascua' },
  ]
    .filter(f => fechaLocal(f.fecha).getDay() !== 0)
    .map(f => (previsto ? { ...f, previsto: true } : f))
    .sort((x, y) => x.fecha.localeCompare(y.fecha));
}

// Lo que el admin puede guardar como festivo local: [{ fecha, nombre }] limpio, sin
// repetidos y por fecha (lo mismo que valida el servidor).
export function limpiarFestivosLocales(lista = []) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : [])
    .map(f => ({ fecha: String(f?.fecha || ''), nombre: String(f?.nombre || '').trim().slice(0, 60) }))
    .filter(f => FECHA.test(f.fecha) && !Number.isNaN(fechaLocal(f.fecha).getTime()) && !vistos.has(f.fecha) && vistos.add(f.fecha))
    .sort((x, y) => x.fecha.localeCompare(y.fecha));
}

// Los festivos locales que ha añadido el admin. Se cargan una vez (useFestivosLocales) y
// los leen el generador, el Cuadrante y la flota; `alCambiarFestivosLocales` avisa a
// quien los esté pintando.
let locales = [];
const oyentes = new Set();
export const festivosLocales = () => locales;
export function usarFestivosLocales(lista) {
  locales = limpiarFestivosLocales(lista);
  oyentes.forEach(oyente => oyente());
}
export function alCambiarFestivosLocales(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// El festivo de ese día ({ fecha, nombre, local?, previsto? }) o null.
export function festivoEn(fechaIso, extras = locales) {
  if (!FECHA.test(String(fechaIso || ''))) return null;
  const local = (extras || []).find(f => f.fecha === fechaIso);
  if (local) return { fecha: fechaIso, nombre: local.nombre || 'Festivo local', local: true };
  return festivosDelAno(Number(fechaIso.slice(0, 4))).find(f => f.fecha === fechaIso) || null;
}

// ¿Abren ese día los proveedores y los alquileres? Ni festivo ni domingo.
export const esDiaHabil = (fechaIso, extras = locales) => fechaLocal(fechaIso).getDay() !== 0 && !festivoEn(fechaIso, extras);

// El primer día hábil después (`paso` 1) o antes (`paso` -1) de una fecha.
export function diaHabilCercano(fechaIso, paso = 1, extras = locales) {
  let dia = fechaLocal(fechaIso);
  for (let i = 0; i < 14; i++) {
    dia = sumarDias(dia, paso);
    if (esDiaHabil(aIso(dia), extras)) return aIso(dia);
  }
  return fechaIso;
}

// Los festivos (de regla y locales) entre dos fechas, incluidas, por fecha.
export function festivosEntre(desdeIso, hastaIso, extras = locales) {
  const lista = [];
  for (let d = fechaLocal(desdeIso); aIso(d) <= hastaIso; d = sumarDias(d, 1)) {
    const festivo = festivoEn(aIso(d), extras);
    if (festivo) lista.push(festivo);
  }
  return lista;
}
