import { useState, useEffect } from 'react';
import { fetchRosterFromAPI, saveRosterToAPI, saveTarifasToAPI } from '../data/apiService';
import { tarifasPorDefecto, usarTarifasPorDefecto } from '../data/tarifasPorDefecto';

// Sin lista de equipo en el código (el repo es público y llevaba nombres y tarifas
// reales): se usa la última guardada en este dispositivo y, en cuanto llega, la del
// servidor. Un enlace ?worker= se reconoce al llegar el equipo (ver App.jsx).

const CLAVE_TARIFAS = 'gula_tarifas_v1';

export function useWorkers() {
  // Las tarifas por defecto vienen de la base (como el equipo): se usa la última guardada
  // en este dispositivo y, en cuanto llega, la del servidor. Se cargan antes que nada para
  // que lo que pinte la lista ya las tenga.
  const [tarifas, setTarifas] = useState(() => {
    try { usarTarifasPorDefecto(JSON.parse(localStorage.getItem(CLAVE_TARIFAS) || '{}')); } catch { /* sin caché: se esperan las del servidor */ }
    return tarifasPorDefecto();
  });

  const [workersList, setWorkersList] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_workers_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchRosterFromAPI().then(roster => {
      if (!roster) return;
      // Primero las tarifas, luego la lista: lo que se repinte con la lista nueva ya las tiene.
      usarTarifasPorDefecto(roster.tarifas);
      setTarifas(tarifasPorDefecto());
      try { localStorage.setItem(CLAVE_TARIFAS, JSON.stringify(roster.tarifas || {})); } catch { /* sin almacenamiento */ }
      if (roster.workers.length > 0) {
        setWorkersList(roster.workers);
        localStorage.setItem('gula_workers_v1', JSON.stringify(roster.workers));
      }
    }).catch(() => {});
  }, []);

  // El admin cambia las tarifas por defecto (extra, nomina, transporte). → true si se guardó.
  const handleGuardarTarifas = async (nuevas) => {
    const guardadas = await saveTarifasToAPI(nuevas);
    if (!guardadas) return false;
    usarTarifasPorDefecto(guardadas);
    setTarifas(tarifasPorDefecto());
    try { localStorage.setItem(CLAVE_TARIFAS, JSON.stringify(guardadas)); } catch { /* sin almacenamiento */ }
    return true;
  };

  const handleRemoveWorker = (workerName) => {
    const updatedWorkers = workersList.filter(w => w.name !== workerName);
    setWorkersList(updatedWorkers);
    localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers));
    saveRosterToAPI(updatedWorkers).catch(() => {});
  };

  // Cambia las fichas de varias personas en un solo guardado ({ nombre: cambios }): rol,
  // tarifa, "solo si hace falta", nota, disponibilidad fija. Nunca el nombre: de él cuelgan
  // sus fichajes y su saldo. De uno en uno, el segundo cambio partía de la lista de antes y
  // pisaba al primero (el asistente puede cambiar a dos personas a la vez). → true si se guardó.
  const handleUpdateWorkers = (cambiosPorNombre = {}) => {
    const updatedWorkers = workersList.map(w => {
      if (!cambiosPorNombre[w.name]) return w;
      const sinNombre = { ...cambiosPorNombre[w.name] };
      delete sinNombre.name;
      return { ...w, ...sinNombre };
    });
    setWorkersList(updatedWorkers);
    try { localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers)); } catch { /* sin almacenamiento */ }
    return saveRosterToAPI(updatedWorkers);
  };
  const handleUpdateWorker = (nombre, cambios) => handleUpdateWorkers({ [nombre]: cambios });

  return {
    workersList,
    setWorkersList,
    tarifas,
    handleRemoveWorker,
    handleUpdateWorker,
    handleUpdateWorkers,
    handleGuardarTarifas
  };
}
