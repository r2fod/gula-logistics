import { useState } from 'react';
import { 
  saveClockEntryToAPI, 
  updateClockEntryInAPI, 
  deleteClockEntryInAPI, 
  restoreClockEntryInAPI,
  vaciarPapeleraEnAPI
} from '../data/apiService';
import { getActiveShiftForWorker } from '../data/shiftCalculations';
import { useDialog } from '../contexts/DialogContext';

const CLAVE_LOCAL = 'gula_clock_entries_v1';

export function useClockings(markTaskCompleted) {
  const { alert } = useDialog();
  const [clockEntries, setClockEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(CLAVE_LOCAL);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cambia los fichajes a partir de lo que hay AHORA (no de los del render) y guarda
  // la copia local. Antes partía de los del render: al borrar varios seguidos, en
  // pantalla solo quedaba en la papelera el último.
  const actualizarLocal = (cambiar) => setClockEntries(prev => {
    const updated = cambiar(prev);
    try {
      localStorage.setItem(CLAVE_LOCAL, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    return updated;
  });

  const handleClockEntryCreated = (newEntry) => {
    setClockEntries(prev => {
      const updated = [...prev, newEntry];
      try {
        localStorage.setItem(CLAVE_LOCAL, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      
      // Al fichar salida de una tarea concreta (fichada con taskRef desde
      // "Fichar Esta Tarea" / "Fichar Entrada Ahora"), marcarla como hecha
      // sola en el planning — se busca en los fichajes previos a este (el
      // array `prev` de este cierre, sin el `newEntry` todavía).
      if (newEntry.type === 'salida' && markTaskCompleted) {
        const closingShift = getActiveShiftForWorker(prev, newEntry.workerName);
        if (closingShift?.taskRef) {
          markTaskCompleted(closingShift.taskRef);
        }
      }
      return updated;
    });
    
    Promise.resolve(saveClockEntryToAPI(newEntry)).then(async (r) => {
      if (!r?.rechazado) return;
      // El admin exige el enlace personal y este móvil no lo tiene: no se ha fichado.
      actualizarLocal(prev => prev.filter(e => e.id !== newEntry.id));
      await alert(`⚠️ No se ha fichado. ${r.rechazado}`, { type: 'warning' });
    });
  };

  const handleUpdateClockEntry = async (updatedEntry) => {
    actualizarLocal(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    const saved = await updateClockEntryInAPI(updatedEntry);
    if (!saved) {
      // Editar un fichaje (hora, tarifa, tarea...) es una acción deliberada
      // de admin — antes, si fallaba el guardado real, el cambio se veía
      // aquí pero desaparecía solo en el siguiente refresco sin aviso.
      await alert('⚠️ No se pudo guardar este cambio de fichaje en el servidor (posible sesión de administrador caducada o sin conexión). Se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.', { type: 'warning' });
    }
  };

  // Mover a la papelera uno o varios (la revisión de fichajes manda los que sobran).
  const handleDeleteClockEntries = async (ids = []) => {
    const aBorrar = new Set(ids);
    actualizarLocal(prev => prev.map(e => aBorrar.has(e.id) ? { ...e, deleted: true } : e));
    // Sin comprobar esto, un borrado que no llegara de verdad al servidor (sesión
    // caducada, sin conexión) se veía "en la papelera" aquí y volvía a aparecer solo
    // en el siguiente refresco de 20s, sin ninguna explicación.
    const fallidos = (await Promise.all(ids.map(deleteClockEntryInAPI))).filter(ok => !ok).length;
    if (fallidos) {
      await alert(`⚠️ No se ${fallidos === 1 ? 'pudo mover 1 fichaje' : `pudieron mover ${fallidos} fichajes`} a la papelera en el servidor (posible sesión de administrador caducada o sin conexión). Puede volver a aparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el borrado.`, { type: 'warning' });
    }
  };
  const handleDeleteClockEntry = (entryId) => handleDeleteClockEntries([entryId]);

  const handleRestoreClockEntry = async (entryId) => {
    actualizarLocal(prev => prev.map(e => e.id === entryId ? { ...e, deleted: false } : e));
    const ok = await restoreClockEntryInAPI(entryId);
    if (!ok) {
      await alert('⚠️ No se pudo restaurar este fichaje en el servidor (posible sesión de administrador caducada o sin conexión). Puede volver a desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite la restauración.', { type: 'warning' });
    }
  };

  // Vaciar la papelera = borrarlos de la base PARA SIEMPRE. No cambia ninguna cuenta:
  // lo de la papelera ya no contaba en horas ni saldos.
  const handleVaciarPapelera = async () => {
    const enPapelera = clockEntries.filter(e => e.deleted).length;
    const r = await vaciarPapeleraEnAPI();
    if (!r.ok) {
      await alert('⚠️ No se pudo vaciar la papelera (posible sesión de administrador caducada o sin conexión). Vuelve a iniciar sesión de Admin y repítelo.', { type: 'error' });
      return;
    }
    actualizarLocal(prev => prev.filter(e => !e.deleted));
    const n = r.borrados ?? enPapelera;
    await alert(`Papelera vaciada: ${n} ${n === 1 ? 'fichaje borrado' : 'fichajes borrados'} para siempre.`, { type: 'success' });
  };

  // Un turno largo que es real: se marca su entrada y deja de avisar (revisionFichajes.js).
  const handleMarcarRevisado = (entrada) => handleUpdateClockEntry({ ...entrada, revisado: true });

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
    handleDeleteClockEntries,
    handleRestoreClockEntry,
    handleVaciarPapelera,
    handleMarcarRevisado
  };
}
