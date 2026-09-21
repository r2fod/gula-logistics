// Lectura del "Calendario Gula" (otra app del usuario) desde el servidor.
//
// El calendario guarda sus apuntes en un documento de su nube (Firestore) que
// se lee con un código de SOLO LECTURA. La configuración vive en variables de
// entorno de Render — nunca en el repo ni en el bundle del cliente, porque con
// ella cualquiera podría leer el calendario (nombres de clientes, pax, lugares):
//   CALENDARIO_PROJECT_ID, CALENDARIO_API_KEY, CALENDARIO_CODIGO
//
// Solo se devuelve lo que hace falta para planificar y NUNCA los datos de
// personal ni los importes que algunos apuntes traen (`personal`, `notas`).

// Tipos de apunte que interesan al planning. El resto (tarea/visita, cerrado,
// producción...) se descarta aquí, en el origen.
export const TIPOS_UTILES = ['boda', 'comunion', 'corporativo', 'recogida', 'vacaciones'];

export function calendarioConfigurado(env = process.env) {
  return Boolean(env.CALENDARIO_PROJECT_ID && env.CALENDARIO_API_KEY && env.CALENDARIO_CODIGO);
}

export class CalendarioError extends Error {
  constructor(mensaje, estado = 502) {
    super(mensaje);
    this.estado = estado;
  }
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Deja solo los campos necesarios y con tipos seguros.
export function normalizarApunte(a) {
  if (!a || typeof a !== 'object' || !FECHA.test(String(a.fecha || ''))) return null;
  const tipo = String(a.tipo || '');
  if (!TIPOS_UTILES.includes(tipo)) return null;
  const out = { id: String(a.id ?? ''), fecha: a.fecha, tipo, titulo: String(a.titulo ?? '').slice(0, 200) };
  if (FECHA.test(String(a.hasta || ''))) out.hasta = a.hasta;
  const pax = Number(a.pax);
  if (Number.isFinite(pax) && pax > 0 && pax < 5000) out.pax = Math.round(pax); // "10015" del calendario = dato mal escrito
  if (a.sitio) out.sitio = String(a.sitio).slice(0, 200);
  if (/^\d{1,2}:\d{2}$/.test(String(a.hora || ''))) out.hora = a.hora;
  return out;
}

// desde/hasta: 'YYYY-MM-DD' (incluidos). Un apunte con `hasta` cuenta si su
// rango se solapa con el pedido (un alquiler continuo, unas vacaciones...).
export async function leerApuntes({ desde, hasta, env = process.env, fetchFn = fetch } = {}) {
  if (!calendarioConfigurado(env)) throw new CalendarioError('El calendario no está configurado en el servidor', 503);
  if (!FECHA.test(String(desde || '')) || !FECHA.test(String(hasta || '')) || desde > hasta) {
    throw new CalendarioError('desde y hasta deben ser fechas YYYY-MM-DD con desde <= hasta', 400);
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.CALENDARIO_PROJECT_ID)}`
    + `/databases/(default)/documents/calendario/${encodeURIComponent(env.CALENDARIO_CODIGO)}`
    + `?key=${encodeURIComponent(env.CALENDARIO_API_KEY)}`;

  let res;
  try {
    res = await fetchFn(url);
  } catch {
    // Nunca se incluye la URL en el error: lleva la clave.
    throw new CalendarioError('No se pudo conectar con el calendario');
  }
  if (!res.ok) throw new CalendarioError(`El calendario respondió con error (${res.status})`);

  let apuntes;
  try {
    const doc = await res.json();
    apuntes = JSON.parse(doc?.fields?.apuntes?.stringValue || '[]');
  } catch {
    throw new CalendarioError('La respuesta del calendario no tiene el formato esperado');
  }
  if (!Array.isArray(apuntes)) throw new CalendarioError('La respuesta del calendario no tiene el formato esperado');

  return apuntes
    .map(normalizarApunte)
    .filter(a => a && a.fecha <= hasta && (a.hasta || a.fecha) >= desde)
    .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.tipo.localeCompare(y.tipo));
}
