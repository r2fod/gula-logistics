import { useState, useEffect } from 'react';
import { fetchRosterFromAPI, saveRosterToAPI } from '../data/apiService';

// Sin lista de equipo en el código (el repo es público y llevaba nombres y tarifas
// reales): se usa la última guardada en este dispositivo y, en cuanto llega, la del
// servidor. Un enlace ?worker= se reconoce al llegar el equipo (ver App.jsx).

export function useWorkers() {
  const [workersList, setWorkersList] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_workers_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchRosterFromAPI().then(apiWorkers => {
      if (apiWorkers && apiWorkers.length > 0) {
        setWorkersList(apiWorkers);
        localStorage.setItem('gula_workers_v1', JSON.stringify(apiWorkers));
      }
    }).catch(() => {});
  }, []);

  const handleRemoveWorker = (workerName) => {
    const updatedWorkers = workersList.filter(w => w.name !== workerName);
    setWorkersList(updatedWorkers);
    localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers));
    saveRosterToAPI(updatedWorkers).catch(() => {});
  };

  return {
    workersList,
    setWorkersList,
    handleRemoveWorker
  };
}
