// Anticipación automática de semanas: prepara como BORRADOR las próximas
// semanas (por defecto las 2 siguientes) leyendo el calendario, para tenerlas
// controladas con tiempo. Nunca activa nada: un admin revisa el borrador y lo
// acepta (ver el banner de PartnerDashboardView).
import { generarBorrador, martesDeSemana, weekIdParaInicio, formatearRango } from './weekGenerator';
import { parseWeekRange, isWeekFinished } from './taskPlanning';

const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };

// Cuántos días por delante puede empezar la semana siguiente para abrirla ya, cuando la actual ha terminado.
const DIAS_PARA_ADELANTAR = 3;

export const esBorrador = (semana) => semana?.meta?.status === 'Borrador';

// Martes que abre una semana ya creada (según su meta.dateRange), o null.
const inicioDeSemana = (semana, hoy) => parseWeekRange(semana?.meta?.dateRange, hoy)?.start || null;

// Martes de las `horizonte` semanas siguientes a la actual que TODAVÍA no existen
// (ni como semana ni como borrador). El lunes cuenta como cola de la semana anterior.
export function semanasAAnticipar(semanas, hoy = new Date(), horizonte = 2) {
  const actual = martesDeSemana(hoy);
  const existentes = new Set(Object.values(semanas || {}).map(w => inicioDeSemana(w, hoy)).filter(Boolean).map(aIso));
  const inicios = [];
  for (let i = 1; i <= horizonte; i++) {
    const inicio = sumarDias(actual, 7 * i);
    if (!existentes.has(aIso(inicio))) inicios.push(inicio);
  }
  return inicios;
}

// Semana que se abre por defecto (sin ?week= en el enlace): la NO borrador cuyo
// rango contiene hoy (con su lunes de cola); si no hay, la última ya empezada.
// Si esa semana ya ha TERMINADO del todo (isWeekFinished: p. ej. el lunes por la
// tarde, con todas las tareas de la cola hechas) y la siguiente, aceptada, empieza
// en los próximos días, se abre la siguiente: al refrescar el lunes por la noche no
// se vuelve a la semana que ya pasó. Un borrador nunca cuenta.
// null si no se puede decidir (el llamador conserva lo que tuviera).
export function semanaPorDefecto(semanas, hoy = new Date()) {
  const hoyIso = aIso(hoy);
  const candidatas = Object.entries(semanas || {})
    .filter(([, w]) => !esBorrador(w))
    .map(([id, w]) => ({ id: w.id || id, semana: w, inicio: inicioDeSemana(w, hoy) }))
    .filter(c => c.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  const contiene = candidatas.find(c => hoyIso >= aIso(c.inicio) && hoyIso <= aIso(sumarDias(c.inicio, 6)));
  if (contiene) {
    const siguiente = candidatas.find(c => c.inicio > contiene.inicio);
    const empiezaPronto = siguiente && aIso(siguiente.inicio) <= aIso(sumarDias(hoy, DIAS_PARA_ADELANTAR));
    return empiezaPronto && isWeekFinished(contiene.semana, hoy) ? siguiente.id : contiene.id;
  }
  const empezadas = candidatas.filter(c => aIso(c.inicio) <= hoyIso);
  return empezadas.length ? empezadas[empezadas.length - 1].id : null;
}

// "Semana N" con N = mayor número existente + 1.
export function siguienteNombre(semanas, ya = 0) {
  const numeros = Object.values(semanas || {}).map(w => Number(String(w?.name || '').match(/(\d+)/)?.[1])).filter(Number.isFinite);
  return `Semana ${(numeros.length ? Math.max(...numeros) : 0) + 1 + ya}`;
}

// Equipo y camiones de la semana más reciente que NO es borrador.
const plantillaDe = (semanas, hoy) => {
  const validas = Object.values(semanas || {}).filter(w => !esBorrador(w) && inicioDeSemana(w, hoy));
  validas.sort((a, b) => inicioDeSemana(a, hoy) - inicioDeSemana(b, hoy));
  const w = validas[validas.length - 1] || {};
  return { team: w.team || [], trucks: w.trucks || [] };
};

// Genera y guarda los borradores que falten. Todas las dependencias se inyectan:
//   leerApuntes(desde, hasta) -> { configurado, apuntes, error? }
//   crearBorrador(weekId, week, reemplazar) -> { ok, existe? }
// `inicios` (opcional) fuerza qué semanas generar (regenerar un borrador) e
// `idsForzados` ({ 'YYYY-MM-DD': weekId }) qué id usar en ese caso.
export async function anticiparSemanas({ semanas, hoy = new Date(), roster = [], leerApuntes, crearBorrador, horizonte = 2, inicios = null, reemplazar = false, idsForzados = {} }) {
  const candidatos = inicios || semanasAAnticipar(semanas, hoy, horizonte);
  if (candidatos.length === 0) return { estado: 'nada', creadas: [], omitidas: [] };

  const desde = aIso(candidatos[0]);
  const hasta = aIso(sumarDias(candidatos[candidatos.length - 1], 6));
  const lectura = await leerApuntes(desde, hasta);
  if (lectura?.configurado === false) return { estado: 'no-configurado', creadas: [], omitidas: [] };
  if (!lectura || lectura.error) return { estado: 'error', error: lectura?.error || 'sin respuesta', creadas: [], omitidas: [] };

  const plantilla = plantillaDe(semanas, hoy);
  const creadas = [];
  const omitidas = [];
  for (const inicio of candidatos) {
    // Regenerar un borrador conserva SU id (idsForzados[fecha]); si no, el determinista.
    const weekId = idsForzados[aIso(inicio)] || weekIdParaInicio(inicio);
    const existingWeek = semanas?.[weekId] || Object.values(semanas || {}).find(w => w.id === weekId);
    
    // Si la semana ya existía (ej. estamos regenerando un borrador), conservamos su número/nombre.
    // Si es nueva, le asignamos el siguiente nombre libre.
    const nombreParaBorrador = existingWeek?.name || siguienteNombre(semanas, creadas.length);

    const { week, resumen } = generarBorrador({
      inicio, apuntes: lectura.apuntes, roster, plantilla, nombre: nombreParaBorrador, ahora: hoy,
    });
    if (resumen.eventos === 0 && resumen.alquileres === 0) { omitidas.push({ inicio, motivo: 'sin eventos ni alquileres en el calendario' }); continue; }
    
    const r = await crearBorrador(weekId, { ...week, id: weekId }, reemplazar);
    if (r?.ok) creadas.push({ weekId, name: week.name, dateRange: week.meta.dateRange, resumen });
    else omitidas.push({ inicio, motivo: r?.existe ? 'ya existe' : `no se pudo guardar${r?.status ? ` (${r.status})` : ''}` });
  }
  return { estado: 'ok', creadas, omitidas };
}

export { formatearRango };
