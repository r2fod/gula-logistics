import { useState, useRef } from 'react';
import { logisticsData as BASE_DATA } from '../data/logisticsData';
import { saveWeeksToAPI, patchTaskCompletionInAPI } from '../data/apiService';
import { semanaPorDefecto } from '../data/anticipacion';
import { getTaskListForDay, buildTaskListPatch, isTaskEffectivelyDone, ensureYearInDateRange, clearWeekCompletion } from '../data/taskPlanning';
import { useDialog } from '../contexts/DialogContext';

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  ...BASE_DATA
};

export function useWeeks() {
  const { alert } = useDialog();
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v10');
      return saved ? JSON.parse(saved) : { week_3: BASE_WEEK_3 };
    } catch {
      return { week_3: BASE_WEEK_3 };
    }
  });

  // Al abrir, la semana en la que estamos (la de hoy; si ya terminó del todo, la
  // siguiente) según lo último que se guardó en este dispositivo: así no se ve un
  // instante la semana 3 antes de que lleguen los datos del servidor.
  const [semanaElegida, setActiveWeekId] = useState(() => {
    const inicial = semanaPorDefecto(allWeeks, new Date());
    return inicial && allWeeks[inicial] ? inicial : 'week_3';
  });
  // La semana activa SIEMPRE es una que existe. Si el id elegido no está entre las
  // semanas (un selector con un valor que no es un id, una semana que aún no ha
  // llegado del servidor...) se usa la semana de hoy, o la primera: antes se caía en
  // la semana de ejemplo del código ("Tarea de ejemplo", sin datos) y cualquier cambio
  // se guardaba con ese id inventado.
  const activeWeekId = allWeeks[semanaElegida]
    ? semanaElegida
    : (semanaPorDefecto(allWeeks, new Date()) || Object.keys(allWeeks)[0] || semanaElegida);
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
    const result = await saveWeeksToAPI(newWeeks);

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
  };

  const handleUpdateActiveWeek = (updatedWeekData) => {
    const newWeeks = { ...allWeeks, [activeWeekId]: updatedWeekData };
    updateWeeks(newWeeks);
  };

  // Las tareas SOLO se marcan a mano (clic aquí, o la salida de un fichaje de
  // esa tarea en markTaskCompleted): nada las marca solas al pasar su hora. El
  // clic invierte lo que se VE (isTaskEffectivelyDone) y, al marcar, guarda la
  // hora real (`completedAt`).
  const toggleTask = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const newCompleted = !isTaskEffectivelyDone(activeWeek, dayKey, taskItem, new Date());
    const reopened = !newCompleted;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    if (typeof taskItem === 'object') {
      list[taskIdx] = { ...taskItem, completed: newCompleted, reopened, completedAt };
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted, reopened, completedAt };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, newCompleted, reopened, completedAt);
  };

  const markTaskCompleted = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const completedAt = new Date().toISOString();
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      list[taskIdx] = { ...taskItem, completed: true, reopened: false, completedAt };
    } else {
      list[taskIdx] = { text: taskItem, completed: true, reopened: false, completedAt };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    // Igual que toggleTask: sin esto, el polling de 20s podía traer de
    // vuelta datos del servidor de antes de que este PATCH llegara y
    // desmarcar la tarea que se acaba de completar (el mismo bug que ya
    // se arregló para el toggle manual, pero aquí faltaba).
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, true, false, completedAt);
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

  const handleApplyGeminiSchedule = (aiGeneratedJson) => {
    // dateRange se conserva: el JSON de la IA trae un texto de relleno
    // ("Fechas...") que dejaría la semana sin fechas legibles y desactivaría
    // el marcado/tachado de tareas por horario.
    const updatedWeek = {
      ...activeWeek,
      meta: { ...activeWeek.meta, ...aiGeneratedJson.meta, dateRange: activeWeek.meta?.dateRange },
      schedule: aiGeneratedJson.schedule || activeWeek.schedule,
      saturdaySpecial: aiGeneratedJson.saturdaySpecial || activeWeek.saturdaySpecial,
      sundayMonday: aiGeneratedJson.sundayMonday || activeWeek.sundayMonday
    };
    updateWeeks({ ...allWeeks, [activeWeekId]: updatedWeek });
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
    lastLocalEditRef
  };
}
