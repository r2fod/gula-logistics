import { useState, useRef } from 'react';
import { logisticsData as BASE_DATA } from '../data/logisticsData';
import { saveWeeksToAPI, patchTaskCompletionInAPI } from '../data/apiService';
import { getTaskListForDay, buildTaskListPatch, isTaskChronologicallyPast, TASK_COMPLETION_GRACE_MINUTES } from '../data/taskPlanning';

const ALL_DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'domingo', 'sabado'];

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  ...BASE_DATA
};

export function useWeeks() {
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v10');
      return saved ? JSON.parse(saved) : { week_3: BASE_WEEK_3 };
    } catch {
      return { week_3: BASE_WEEK_3 };
    }
  });

  const [activeWeekId, setActiveWeekId] = useState('week_3');
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
      alert(result.message || '⚠️ Alguien más ha guardado cambios en esta semana mientras la editabas. Se ha recargado la versión más reciente — revisa y repite tu cambio si todavía hace falta.');
      return;
    }

    if (!result) {
      alert('⚠️ No se pudo guardar en el servidor (posible sesión de administrador caducada). El cambio se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.');
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

  const toggleTask = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const newCompleted = typeof taskItem === 'object' ? !taskItem.completed : true;
    if (typeof taskItem === 'object') {
      list[taskIdx] = { ...taskItem, completed: newCompleted };
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, newCompleted);
  };

  const markTaskCompleted = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      list[taskIdx] = { ...taskItem, completed: true };
    } else {
      list[taskIdx] = { text: taskItem, completed: true };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    // Igual que toggleTask: sin esto, el polling de 20s podía traer de
    // vuelta datos del servidor de antes de que este PATCH llegara y
    // desmarcar la tarea que se acaba de completar (el mismo bug que ya
    // se arregló para el toggle manual, pero aquí faltaba).
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, true);
  };

  // Recorre TODAS las tareas de la semana activa (días normales, domingo/
  // lunes, y bodas de sábado) y marca como completadas de verdad en Mongo
  // las que ya pasaron su horario con margen de sobra (TASK_COMPLETION_
  // GRACE_MINUTES) y todavía no lo estaban. markTaskCompleted ya es idempotente
  // (no hace nada si una tarea ya estaba completada), así que llamar a esto
  // varias veces seguidas es seguro — no vuelve a desmarcar nada.
  const autoCompletePastTasks = () => {
    const now = new Date();
    ALL_DAY_KEYS.forEach(dayKey => {
      const list = getTaskListForDay(activeWeek, dayKey);
      list.forEach((task, idx) => {
        const isObj = typeof task === 'object' && task !== null;
        if (isObj && task.completed) return;
        const timeFrame = isObj ? task.timeFrame : null;
        if (isTaskChronologicallyPast(dayKey, timeFrame, now, TASK_COMPLETION_GRACE_MINUTES)) {
          markTaskCompleted(dayKey, idx);
        }
      });
    });
  };

  const handleCreateWeek = ({ name, dateRange, cloneCurrent }) => {
    const newId = `week_${Date.now()}`;
    const template = cloneCurrent ? JSON.parse(JSON.stringify(activeWeek)) : JSON.parse(JSON.stringify(BASE_WEEK_3));
    
    const newWeekObj = {
      ...template,
      id: newId,
      name,
      meta: {
        ...template.meta,
        week: name,
        dateRange,
        status: "Operativa Activa"
      }
    };

    updateWeeks({ ...allWeeks, [newId]: newWeekObj });
    setActiveWeekId(newId);
  };

  const handleApplyGeminiSchedule = (aiGeneratedJson) => {
    const updatedWeek = {
      ...activeWeek,
      meta: { ...activeWeek.meta, ...aiGeneratedJson.meta },
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
    autoCompletePastTasks,
    handleCreateWeek,
    handleApplyGeminiSchedule,
    lastLocalEditRef
  };
}
