import { useState } from 'react';
import { 
  saveClockEntryToAPI, 
  updateClockEntryInAPI, 
  deleteClockEntryInAPI, 
  clearAllClockEntriesInAPI,
  restoreClockEntryInAPI
} from '../data/apiService';
import { getActiveShiftForWorker } from '../data/shiftCalculations';

export function useClockings(markTaskCompleted) {
  const [clockEntries, setClockEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_clock_entries_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleClockEntryCreated = (newEntry) => {
    const updated = [...clockEntries, newEntry];
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    saveClockEntryToAPI(newEntry);

    // Al fichar salida de una tarea concreta (fichada con taskRef desde
    // "Fichar Esta Tarea" / "Fichar Entrada Ahora"), marcarla como hecha
    // sola en el planning — se busca en los fichajes previos a este (el
    // array `clockEntries` de este cierre, sin el `newEntry` todavía).
    if (newEntry.type === 'salida' && markTaskCompleted) {
      const closingShift = getActiveShiftForWorker(clockEntries, newEntry.workerName);
      if (closingShift?.taskRef) {
        markTaskCompleted(closingShift.taskRef.dayKey, closingShift.taskRef.taskIndex);
      }
    }
  };

  const handleUpdateClockEntry = async (updatedEntry) => {
    const updated = clockEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    const saved = await updateClockEntryInAPI(updatedEntry);
    if (!saved) {
      // Editar un fichaje (hora, tarifa, tarea...) es una acción deliberada
      // de admin — antes, si fallaba el guardado real, el cambio se veía
      // aquí pero desaparecía solo en el siguiente refresco sin aviso.
      alert('⚠️ No se pudo guardar este cambio de fichaje en el servidor (posible sesión de administrador caducada o sin conexión). Se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.');
    }
  };

  const handleDeleteClockEntry = async (entryId) => {
    const updated = clockEntries.map(e => e.id === entryId ? { ...e, deleted: true } : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    // Igual que handleUpdateClockEntry: sin comprobar esto, un borrado que
    // no llegara de verdad al servidor (sesión caducada, sin conexión) se
    // veía "en la papelera" aquí y volvía a aparecer solo en el siguiente
    // refresco de 20s, sin ninguna explicación.
    const ok = await deleteClockEntryInAPI(entryId);
    if (!ok) {
      alert('⚠️ No se pudo mover este fichaje a la papelera en el servidor (posible sesión de administrador caducada o sin conexión). Puede volver a aparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el borrado.');
    }
  };

  const handleRestoreClockEntry = async (entryId) => {
    const updated = clockEntries.map(e => e.id === entryId ? { ...e, deleted: false } : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    const ok = await restoreClockEntryInAPI(entryId);
    if (!ok) {
      alert('⚠️ No se pudo restaurar este fichaje en el servidor (posible sesión de administrador caducada o sin conexión). Puede volver a desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite la restauración.');
    }
  };

  const handleClearClockEntries = () => {
    setClockEntries([]);
    localStorage.removeItem('gula_clock_entries_v1');
    clearAllClockEntriesInAPI();
  };

  const activeClockEntries = clockEntries.filter(e => !e.deleted);
  const deletedClockEntries = clockEntries.filter(e => e.deleted);

  return {
    clockEntries,
    setClockEntries,
    activeClockEntries,
    deletedClockEntries,
    handleClockEntryCreated,
    handleUpdateClockEntry,
    handleDeleteClockEntry,
    handleRestoreClockEntry,
    handleClearClockEntries
  };
}
