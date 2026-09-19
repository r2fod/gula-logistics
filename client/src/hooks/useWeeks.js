import { useState } from 'react';
import { logisticsData as BASE_DATA } from '../data/logisticsData';
import { saveWeeksToAPI, patchTaskCompletionInAPI } from '../data/apiService';
import { getTaskListForDay, buildTaskListPatch } from '../data/taskPlanning';

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
    if (!result) {
      alert('⚠️ No se pudo guardar en el servidor (posible sesión de administrador caducada). El cambio se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.');
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
      taskItem.completed = newCompleted;
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, newCompleted);
  };

  const markTaskCompleted = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      taskItem.completed = true;
    } else {
      list[taskIdx] = { text: taskItem, completed: true };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, true);
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
    handleCreateWeek,
    handleApplyGeminiSchedule
  };
}
