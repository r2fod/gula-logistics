// El domingo y el lunes comparten UNA sola lista de tareas (sundayMonday.tasks)
// en vez de vivir cada uno en schedule.domingo/schedule.lunes — de hecho
// schedule.domingo ni existe. Este mismo caso especial se repetía suelto en
// varios sitios (WorkerView, App.jsx) y ya causó un bug real: se arregló en
// un sitio y no en los demás, así que el domingo se quedaba sin poder
// completarse. A partir de ahora esta es la ÚNICA fuente de verdad sobre
// dónde vive la lista de tareas de un día — todo el mundo debe usar esto en
// vez de repetir el `dayKey === 'domingo'` a mano.
export function getTaskListForDay(weekData, dayKey) {
  if (!weekData) return [];
  if (dayKey === 'sabado') return weekData.saturdaySpecial?.weddings || [];
  return dayKey === 'domingo'
    ? (weekData.sundayMonday?.tasks || [])
    : (weekData.schedule?.[dayKey]?.tasks || []);
}

// Busca el índice REAL de una tarea por su texto dentro de la lista completa
// de su día de origen. Necesario porque las listas que se muestran en
// pantalla suelen estar filtradas (por trabajador asignado, por completada,
// etc.), así que el índice visible ahí nunca es el índice real en Mongo.
export function resolveTaskIndexByText(weekData, dayKey, taskText) {
  const list = getTaskListForDay(weekData, dayKey);
  const idx = list.findIndex(t => {
    if (dayKey === 'sabado') return `Boda: ${t.location} (${t.truck})` === taskText || t.location === taskText;
    return (typeof t === 'object' ? t.text : t) === taskText;
  });
  return idx !== -1 ? idx : null;
}

// Construye el fragmento de actualización con la forma correcta para
// guardar de vuelta una lista de tareas ya modificada de un día, según si
// es domingo/lunes (bajo la clave `sundayMonday`) o un día normal (bajo
// `schedule[dayKey]`). Combinar con `{ ...weekData, ...patch }`.
export function buildTaskListPatch(weekData, dayKey, updatedList) {
  if (dayKey === 'sabado') {
    return { saturdaySpecial: { ...weekData.saturdaySpecial, weddings: updatedList } };
  }
  return dayKey === 'domingo'
    ? { sundayMonday: { ...weekData.sundayMonday, tasks: updatedList } }
    : { schedule: { ...weekData.schedule, [dayKey]: { ...weekData.schedule?.[dayKey], tasks: updatedList } } };
}
