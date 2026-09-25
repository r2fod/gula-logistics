import { useState, useEffect } from 'react';
import { fetchRosterFromAPI, saveRosterToAPI } from '../data/apiService';

export const DEFAULT_WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión Covey (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión Gula (Propio)", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión Covey / Apoyo", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Irene", role: "Ayudante Logística / Prepara Eventos / Verifica Checklist", truck: "Almacén Base", avatar: "📦", isPayroll: true, rate: 14 },
  { name: "Jeferson", role: "Apoyo Logística & Prep", truck: "Base / Camión Gula", avatar: "📦", isPayroll: false, rate: 10 },
  { name: "Kerly", role: "Gula Limpieza Eventos", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Jose", role: "Gula Limpieza & Apoyo", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Raúl", role: "Jefe de Logística", truck: "Supervisión Flota", avatar: "📋", isPayroll: true, rate: 14 }
];

export function useWorkers() {
  const [workersList, setWorkersList] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_workers_v1');
      return saved ? JSON.parse(saved) : DEFAULT_WORKERS_LIST;
    } catch {
      return DEFAULT_WORKERS_LIST;
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
