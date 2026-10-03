import { useState, useRef, useMemo } from 'react';
import { logisticsData as BASE_DATA } from '../data/logisticsData';
import { saveWeeksToAPI, patchTaskCompletionInAPI } from '../data/apiService';
import { semanaPorDefecto } from '../data/anticipacion';
import { getTaskListForDay, buildTaskListPatch, isTaskEffectivelyDone, ensureYearInDateRange, clearWeekCompletion, indiceDeTareaFichada } from '../data/taskPlanning';
import { useDialog } from '../contexts/DialogContext';
import { useAhora } from './useAhora';

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  ...BASE_DATA
};

// `persona`: el trabajador cuya vista se enseña (su semana "de hoy" mira solo sus
// tareas). `congelar`: hay un editor abierto y la semana no puede cambiar sola.
export function useWeeks({ persona = null, congelar = false } = {}) {
  const { alert } = useDialog();
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v10');
      return saved ? JSON.parse(saved) : { week_3: BASE_WEEK_3 };
    } catch {
      return { week_3: BASE_WEEK_3 };
    }
  });

  // Semana elegida a mano (selector, víspera, semana nueva, ?week= de un admin). null =
  // la app sigue sola "la de hoy" (semanaPorDefecto): se recalcula cada minuto y con
  // cada dato nuevo, así que el lunes de cola pasa a la semana siguiente en cuanto la
  // anterior termina, sin recargar. Antes se decidía una vez al abrir y la app se
  // quedaba en la semana vieja hasta recargar.
  const [semanaElegida, setActiveWeekId] = useState(null);
  const ahora = useAhora(60 * 1000);
  const deHoy = useMemo(() => semanaPorDefecto(allWeeks, ahora, persona), [allWeeks, ahora, persona]);
  // Con un editor abierto no cambia: guardaría lo editado encima de la otra semana.
  const [deHoyVista, setDeHoyVista] = useState(deHoy);
  if (!congelar && deHoy !== deHoyVista) setDeHoyVista(deHoy);
  // La semana activa SIEMPRE es una que existe. Si el id elegido no está entre las
  // semanas (un selector con un valor que no es un id, una semana que aún no ha
  // llegado del servidor...) se usa la semana de hoy, o la primera: antes se caía en
  // la semana de ejemplo del código ("Tarea de ejemplo", sin datos) y cualquier cambio
  // se guardaba con ese id inventado.
  const activeWeekId = [semanaElegida, deHoyVista, deHoy].find(id => id && allWeeks[id]) || Object.keys(allWeeks)[0] || 'week_3';
  const activeWeek = allWeeks[activeWeekId] || BASE_WEEK_3;

  // Timestamp del último cambio local (toggle, etc.) para que el polling
  // no sobreescriba un cambio que el usuario acaba de hacer.
  const lastLocalEditRef = useRef(0);

  const applyLocalWeeksState = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v10', JSON.stringify(newWeeks));
    } catch (e) {
      console.error(e);
    }
  };

  const updateWeeks = async (newWeeks) => {
    applyLocalWeeksState(newWeeks);
    // Solo se envían las semanas que han cambiado. Antes iban TODAS en cada guardado:
    // el servidor las reescribía todas (y subía su `updatedAt`, provocando conflictos
    // falsos en otras semanas) y, con unas 10 semanas, la petición pasaba del límite
    // del servidor y guardar dejaba de funcionar.
    const cambiadas = Object.fromEntries(Object.entries(newWeeks).filter(([id, semana]) => semana !== allWeeks[id]));
    const result = await saveWeeksToAPI(Object.keys(cambiadas).length ? cambiadas : newWeeks);

    if (result?.conflict) {
      // Alguien más ha guardado esta semana desde que se abrió para editar
      // (control de concurrencia por `updatedAt` en logistics.routes.js) —
      // NO reintentar a ciegas, eso perdería ese otro cambio otra vez.
      // Se refresca con la versión real del servidor (fusionada sobre lo
      // que ya había en local, para no perder otras semanas que el
      // servidor no tenga en su caché) y se avisa para repetir el cambio
      // a mano sobre esa base si todavía hace falta.
      if (result.data) {
        applyLocalWeeksState({ ...newWeeks, ...result.data });
      }
      await alert(result.message || '⚠️ Alguien más ha guardado cambios en esta semana mientras la editabas. Se ha recargado la versión más reciente — revisa y repite tu cambio si todavía hace falta.', { type: 'warning' });
      return;
    }

    if (!result) {
      await alert('⚠️ No se pudo guardar en el servidor (posible sesión de administrador caducada). El cambio se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.', { type: 'warning' });
      return;
    }

    // Éxito: sincronizar el `updatedAt` real que ha quedado en el servidor
    // tras guardar — si no, el siguiente guardado de esta misma sesión
    // compararía contra el `updatedAt` viejo que todavía tendría el estado
    // local y se autoconflictuaría contra su propio guardado anterior.
    if (result.data) {
      applyLocalWeeksState({ ...newWeeks, ...result.data });
    }
    return result;
  };

  const handleUpdateActiveWeek = (updatedWeekData) => {
    const newWeeks = { ...allWeeks, [activeWeekId]: updatedWeekData };
    updateWeeks(newWeeks);
  };

  // Las tareas SOLO se marcan a mano (clic aquí, o la salida de un fichaje de
  // esa tarea en markTaskCompleted): nada las marca solas al pasar su hora. El
  // clic invierte lo que se VE (isTaskEffectivelyDone) y, al marcar, guarda la
  // hora real (`completedAt`).
  const toggleTask = (dayKey, taskIdx, targetWeekId = activeWeekId) => {
    const semana = allWeeks[targetWeekId] || activeWeek;
    if (!semana) return;
    const list = [...getTaskListForDay(semana, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const newCompleted = !isTaskEffectivelyDone(semana, dayKey, taskItem, new Date());
    const reopened = !newCompleted;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    if (typeof taskItem === 'object') {
      list[taskIdx] = { ...taskItem, completed: newCompleted, reopened, completedAt };
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted, reopened, completedAt };
    }
    applyLocalWeeksState({ ...allWeeks, [targetWeekId]: { ...semana, ...buildTaskListPatch(semana, dayKey, list) } });
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(targetWeekId, dayKey, taskIdx, newCompleted, reopened, completedAt);
  };

  // `taskRef`: la del fichaje de entrada (refDeTareaFichada). Se marca en SU semana (el
  // lunes de cola puede no ser la que se está viendo) y la tarea se busca por id o texto
  // (indiceDeTareaFichada): si el admin reordenó el día, antes se marcaba otra.
  const markTaskCompleted = (taskRef) => {
    const weekId = taskRef?.weekId && allWeeks[taskRef.weekId] ? taskRef.weekId : activeWeekId;
    const semana = allWeeks[weekId] || activeWeek;
    const dayKey = taskRef?.dayKey;
    const taskIdx = indiceDeTareaFichada(semana, taskRef);
    if (taskIdx == null) return;
    const list = [...getTaskListForDay(semana, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const completedAt = new Date().toISOString();
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      list[taskIdx] = { ...taskItem, completed: true, reopened: false, completedAt };
    } else {
      list[taskIdx] = { text: taskItem, completed: true, reopened: false, completedAt };
    }
    applyLocalWeeksState({ ...allWeeks, [weekId]: { ...semana, ...buildTaskListPatch(semana, dayKey, list) } });
    // Igual que toggleTask: sin esto, el polling de 20s podía traer de
    // vuelta datos del servidor de antes de que este PATCH llegara y
    // desmarcar la tarea que se acaba de completar (el mismo bug que ya
    // se arregló para el toggle manual, pero aquí faltaba).
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(weekId, dayKey, taskIdx, true, false, completedAt);
  };

  // aiGeneratedJson (opcional): viene del asistente guiado de
  // WeekManagerModal.jsx, que le pide a Gemini la planificación completa a
  // partir de las respuestas del usuario (camiones, disponibilidad,
  // bodas...). Cuando viene, sustituye schedule/saturdaySpecial/sundayMonday
  // del template — el template (clonado o base) solo aporta trucks/team si
  // no los trae el propio JSON generado.
  const handleCreateWeek = ({ name, dateRange, cloneCurrent, aiGeneratedJson, events = [] }) => {
    const newId = `week_${Date.now()}`;
    const template = cloneCurrent ? JSON.parse(JSON.stringify(activeWeek)) : JSON.parse(JSON.stringify(BASE_WEEK_3));

    // clearWeekCompletion: una semana clonada o generada por IA no debe
    // heredar los "completada" de la anterior (llegaría toda tachada), y
    // ensureYearInDateRange fija el año en el texto para que las fechas de
    // las tareas se resuelvan siempre contra la semana correcta.
    const newWeekObj = clearWeekCompletion({
      ...template,
      id: newId,
      name,
      meta: {
        ...template.meta,
        ...(aiGeneratedJson?.meta || {}),
        week: name,
        dateRange: ensureYearInDateRange(dateRange),
        status: "Operativa Activa"
      },
      // Bodas y eventos de la semana con sus pax ([{ name, pax }]). Siempre los
      // de ESTA semana: una semana clonada no hereda los eventos de la anterior.
      events,
      schedule: aiGeneratedJson?.schedule || template.schedule,
      saturdaySpecial: aiGeneratedJson?.saturdaySpecial || template.saturdaySpecial,
      sundayMonday: aiGeneratedJson?.sundayMonday || template.sundayMonday
    });

    updateWeeks({ ...allWeeks, [newId]: newWeekObj });
    setActiveWeekId(newId);
  };

  // Lo último que aplicó Gemini, para poder deshacerlo: { weekId, nombre, anterior,
  // updatedAtTras } (la semana tal como estaba y la versión que dejó el guardado).
  // Solo en memoria: vale mientras no se recargue la app.
  const [deshacerIa, setDeshacerIa] = useState(null);

  const handleApplyGeminiSchedule = async (aiGeneratedJson) => {
    // Gemini solo cambia la planificación: el meta (fechas, nombre, estado) se queda
    // como estaba. Antes se mezclaba el suyo: su "status" de ejemplo ("Operativa
    // Activa") aceptaba sin querer un borrador, y sus fechas de relleno la dejaban
    // sin fechas legibles.
    const anterior = activeWeek;
    const weekId = activeWeekId;
    // Única excepción: la disponibilidad que la app entendió de lo que se escribió
    // ("Tomás no puede el jueves"), nunca algo que venga de Gemini.
    const updatedWeek = {
      ...activeWeek,
      meta: Array.isArray(aiGeneratedJson.disponibilidad) ? { ...activeWeek.meta, disponibilidad: aiGeneratedJson.disponibilidad } : activeWeek.meta,
      schedule: aiGeneratedJson.schedule || activeWeek.schedule,
      saturdaySpecial: aiGeneratedJson.saturdaySpecial || activeWeek.saturdaySpecial,
      sundayMonday: aiGeneratedJson.sundayMonday || activeWeek.sundayMonday
    };
    const resultado = await updateWeeks({ ...allWeeks, [weekId]: updatedWeek });
    // Solo se ofrece deshacer si de verdad se guardó.
    if (resultado && !resultado.conflict) {
      setDeshacerIa({ weekId, nombre: anterior?.name || 'la semana', anterior, updatedAtTras: resultado.data?.[weekId]?.updatedAt ?? null });
    }
  };

  // ¿Ha cambiado la semana (alguien marcó tareas, se editó…) desde que se aplicó?
  const cambiadaTrasIa = () => {
    if (!deshacerIa) return false;
    const actual = allWeeks[deshacerIa.weekId];
    return !!(deshacerIa.updatedAtTras && actual?.updatedAt && actual.updatedAt !== deshacerIa.updatedAtTras);
  };

  // Vuelve a dejar la semana como estaba antes de aplicar lo de Gemini. Se guarda con
  // el `updatedAt` actual (si no, el servidor lo rechazaría como conflicto).
  const deshacerUltimaIa = async () => {
    if (!deshacerIa) return false;
    const actual = allWeeks[deshacerIa.weekId];
    const restaurada = { ...deshacerIa.anterior, updatedAt: actual?.updatedAt ?? deshacerIa.anterior?.updatedAt };
    const resultado = await updateWeeks({ ...allWeeks, [deshacerIa.weekId]: restaurada });
    if (resultado && !resultado.conflict) { setDeshacerIa(null); return true; }
    return false;
  };

  return {
    allWeeks,
    setAllWeeks,
    activeWeekId,
    setActiveWeekId,
    activeWeek,
    updateWeeks,
    handleUpdateActiveWeek,
    toggleTask,
    markTaskCompleted,
    handleCreateWeek,
    handleApplyGeminiSchedule,
    deshacerIa,
    cambiadaTrasIa,
    deshacerUltimaIa,
    olvidarDeshacerIa: () => setDeshacerIa(null),
    lastLocalEditRef
  };
}
