// Horas y coste PREVISTOS según el planning de una semana (el horario de cada
// tarea con gente asignada), no según fichajes: sirve para ver lo que se lleva
// planificado aunque nadie haya fichado. Vivía dentro del informe de Nóminas.
//
// { porPersona: [{ nombre, horas, nomina, tarifa, coste }] (más horas primero),
//   sinHorario: [{ dia, texto, asignados }], horasExtra, costeExtra }
// Los tramos solapados de una persona el mismo día se cuentan una vez. Las tareas
// desactivadas no cuentan. El personal en nómina tiene coste 0 (no se paga aparte).

const tramo = (timeFrame) => {
  const m = String(timeFrame || '').match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return null;
  const inicio = Number(m[1]) * 60 + Number(m[2]);
  let fin = Number(m[3]) * 60 + Number(m[4]);
  if (fin <= inicio) fin += 24 * 60; // cruza medianoche (bodas 20:30 - 02:00)
  return { inicio, fin };
};

const minutosSinSolapes = (tramos) => {
  const ordenados = [...tramos].sort((a, b) => a.inicio - b.inicio);
  const unidos = [];
  ordenados.forEach(t => {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && t.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, t.fin);
    else unidos.push({ ...t });
  });
  return unidos.reduce((suma, t) => suma + (t.fin - t.inicio), 0);
};

export function estimarHorasPlanning(semana, equipo = []) {
  const porPersonaYDia = new Map(); // "nombre|dia" -> [tramos]
  const sinHorario = [];

  const registrar = (dia, etiquetaDia, texto, tarea) => {
    if (!tarea || tarea.active === false || !Array.isArray(tarea.assigned) || !tarea.assigned.length) return;
    const t = tramo(tarea.timeFrame);
    if (!t) { sinHorario.push({ dia: etiquetaDia, texto: texto || '(sin descripción)', asignados: tarea.assigned }); return; }
    tarea.assigned.forEach(nombre => {
      const clave = `${nombre}|${dia}`;
      if (!porPersonaYDia.has(clave)) porPersonaYDia.set(clave, []);
      porPersonaYDia.get(clave).push(t);
    });
  };

  if (semana) {
    Object.entries(semana.schedule || {}).forEach(([dia, d]) => (d?.tasks || []).forEach(t => registrar(dia, d?.title || dia, t?.text, t)));
    (semana.saturdaySpecial?.weddings || []).forEach(b => registrar('sabado', semana.saturdaySpecial?.title || 'Sábado', b.details || b.location, b));
    // Domingo y lunes comparten lista: cada tarea va a su día (sin día, lunes).
    (semana.sundayMonday?.tasks || []).forEach(t => {
      const dia = /domingo/i.test(t?.targetDay || '') ? 'domingo' : 'lunes';
      registrar(dia, semana.sundayMonday?.title || 'Domingo/Lunes', t?.text, t);
    });
  }

  const horasPorPersona = {};
  porPersonaYDia.forEach((tramos, clave) => {
    const nombre = clave.split('|')[0];
    horasPorPersona[nombre] = (horasPorPersona[nombre] || 0) + minutosSinSolapes(tramos) / 60;
  });

  const porPersona = Object.entries(horasPorPersona).map(([nombre, horas]) => {
    const w = equipo.find(p => p.name === nombre);
    const nomina = !!w?.isPayroll;
    const tarifa = w?.rate || (nomina ? 14 : 10);
    return { nombre, horas, nomina, tarifa, coste: nomina ? 0 : horas * tarifa };
  }).sort((a, b) => b.horas - a.horas);

  const extra = porPersona.filter(p => !p.nomina);
  return {
    porPersona,
    sinHorario,
    horasExtra: extra.reduce((s, p) => s + p.horas, 0),
    costeExtra: extra.reduce((s, p) => s + p.coste, 0),
  };
}
