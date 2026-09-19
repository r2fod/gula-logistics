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

  const handleUpdateClockEntry = (updatedEntry) => {
    const updated = clockEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    updateClockEntryInAPI(updatedEntry);
  };

  const handleDeleteClockEntry = (entryId) => {
    const updated = clockEntries.map(e => e.id === entryId ? { ...e, deleted: true } : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    deleteClockEntryInAPI(entryId);
  };

  const handleRestoreClockEntry = (entryId) => {
    const updated = clockEntries.map(e => e.id === entryId ? { ...e, deleted: false } : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    
    restoreClockEntryInAPI(entryId);
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
