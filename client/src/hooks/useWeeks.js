import { useState, useRef } from 'react';
import { logisticsData as BASE_DATA } from '../data/logisticsData';
import { saveWeeksToAPI, patchTaskCompletionInAPI } from '../data/apiService';
import { getTaskListForDay, buildTaskListPatch, getTaskPastStatus, isTaskEffectivelyDone, isWeekFinished, ensureYearInDateRange, clearWeekCompletion, TASK_COMPLETION_GRACE_MINUTES } from '../data/taskPlanning';

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

  // El clic actúa sobre lo que se VE (isTaskEffectivelyDone), no sobre el
  // dato suelto: si la tarea sale hecha por su hora aunque no esté marcada,
  // pulsarla la DESMARCA. Desmarcar deja `reopened: true` para que el reloj no
  // la vuelva a marcar sola; marcarla lo quita.
  const toggleTask = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const newCompleted = !isTaskEffectivelyDone(activeWeek, dayKey, taskItem, new Date());
    const reopened = !newCompleted;
    if (typeof taskItem === 'object') {
      list[taskIdx] = { ...taskItem, completed: newCompleted, reopened };
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted, reopened };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, newCompleted, reopened);
  };

  const markTaskCompleted = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      list[taskIdx] = { ...taskItem, completed: true, reopened: false };
    } else {
      list[taskIdx] = { text: taskItem, completed: true, reopened: false };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    // Igual que toggleTask: sin esto, el polling de 20s podía traer de
    // vuelta datos del servidor de antes de que este PATCH llegara y
    // desmarcar la tarea que se acaba de completar (el mismo bug que ya
    // se arregló para el toggle manual, pero aquí faltaba).
    lastLocalEditRef.current = Date.now();
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, true, false);
  };

  // Una semana TERMINADA lo tiene todo hecho: además de mostrarlo así
  // (isTaskEffectivelyDone), se guarda en Mongo lo que quede sin marcar — tareas
  // sin horario, mal escritas... — en cualquier semana terminada, no solo la
  // activa. Respeta lo desmarcado a propósito (`reopened`). Idempotente: el
  // servidor no escribe si la tarea ya estaba marcada.
  const cerrarSemanasTerminadas = (now = new Date(), inProgressKeys = new Set()) => {
    let cambios = false;
    const semanas = { ...allWeeks };
    Object.entries(allWeeks).forEach(([weekId, week]) => {
      if (!isWeekFinished(week, now)) return;
      let semana = week;
      ALL_DAY_KEYS.forEach(dayKey => {
        const lista = [...getTaskListForDay(semana, dayKey)];
        let tocada = false;
        lista.forEach((task, idx) => {
          if (typeof task !== 'object' || task === null || task.completed || task.reopened) return;
          if (weekId === activeWeekId && inProgressKeys.has(`${dayKey}:${idx}`)) return; // alguien está fichado en ella
          lista[idx] = { ...task, completed: true, reopened: false };
          patchTaskCompletionInAPI(weekId, dayKey, idx, true, false);
          tocada = true;
        });
        if (tocada) { semana = { ...semana, ...buildTaskListPatch(semana, dayKey, lista) }; cambios = true; }
      });
      semanas[weekId] = semana;
    });
    if (cambios) {
      applyLocalWeeksState(semanas);
      lastLocalEditRef.current = Date.now();
    }
  };

  // Recorre TODAS las tareas de la semana activa (días normales, domingo/
  // lunes, y bodas de sábado) y marca como completadas de verdad en Mongo
  // las que ya pasaron su horario con margen de sobra (TASK_COMPLETION_
  // GRACE_MINUTES) y todavía no lo estaban. markTaskCompleted ya es idempotente
  // (no hace nada si una tarea ya estaba completada), así que llamar a esto
  // varias veces seguidas es seguro — no vuelve a desmarcar nada.
  //
  // Es lo ÚNICO que escribe "completada" sin que nadie lo pulse, así que es
  // deliberadamente prudente: getTaskPastStatus compara contra la FECHA REAL
  // de cada tarea (rango de meta.dateRange), no contra el día de la semana
  // suelto, y solo se marca con `=== true` — null (dateRange ilegible) o
  // false (sin horario utilizable, día futuro, semana futura) no tocan nada.
  // Una tarea de la lista domingo/lunes sin `targetDay` se evalúa como lunes
  // (ver resolveTaskEvalDay). markTaskCompleted recibe el dayKey original
  // ('domingo'), que es donde de verdad vive guardada la tarea.
  //
  // No marca (1) una tarea que alguien DESMARCÓ a propósito (`reopened`), ni
  // (2) una tarea "en proceso": `inProgressKeys` son las "dayKey:taskIndex" en
  // las que hay alguien fichado ahora mismo (ver getInProgressTaskKeys).
  const autoCompletePastTasks = (inProgressKeys = new Set()) => {
    const now = new Date();
    cerrarSemanasTerminadas(now, inProgressKeys);
    // Si la activa ya está terminada, lo de arriba lo ha cerrado todo: seguir con
    // el repaso tarea a tarea repetiría los PATCH y pisaría ese estado local.
    if (isWeekFinished(activeWeek, now)) return;
    ALL_DAY_KEYS.forEach(dayKey => {
      const list = getTaskListForDay(activeWeek, dayKey);
      list.forEach((task, idx) => {
        if (typeof task === 'object' && task !== null && (task.completed || task.reopened)) return;
        if (inProgressKeys.has(`${dayKey}:${idx}`)) return;
        if (getTaskPastStatus(activeWeek, dayKey, task, now, TASK_COMPLETION_GRACE_MINUTES) === true) {
          markTaskCompleted(dayKey, idx);
        }
      });
    });
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
    autoCompletePastTasks,
    handleCreateWeek,
    handleApplyGeminiSchedule,
    lastLocalEditRef
  };
}
