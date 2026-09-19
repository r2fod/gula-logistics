import { useState } from 'react';
import { initialBalancesData } from '../data/balancesData';
import { saveWorkerBalanceToAPI } from '../data/apiService';

export function useBalances(workersList, setWorkersList) {
  const [balancesData, setBalancesData] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_balances_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.workers) && parsed.workers.some(w => (w.breakdown && w.breakdown.length > 0) || (w.currentBalance && w.currentBalance !== 0))) {
          return parsed;
        }
      }
      return initialBalancesData;
    } catch {
      return initialBalancesData;
    }
  });

  const handleAddWorker = (newWorker) => {
    // 1. Añadir a la lista de trabajadores
    const updatedWorkers = [...workersList, newWorker];
    setWorkersList(updatedWorkers);
    localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers));

    // 2. Añadir perfil de saldo automático
    const newBalanceProfile = {
      id: newWorker.name.toLowerCase().replace(/\s+/g, '-'),
      name: newWorker.name,
      role: newWorker.role,
      avatar: newWorker.avatar || "👤",
      status: "Sin saldo",
      statusType: "neutral",
      currentBalance: 0.00,
      agreements: [
        "Extra a 10,00 € / hora (Por Defecto)"
      ],
      breakdown: [
        { concept: "Alta inicial en el sistema", amount: 0.00, isPositive: true }
      ],
      notes: "Añadido manualmente al sistema."
    };

    const updatedBalances = {
      ...balancesData,
      workers: [...(balancesData.workers || []), newBalanceProfile]
    };
    setBalancesData(updatedBalances);
    localStorage.setItem('gula_balances_v1', JSON.stringify(updatedBalances));

    // 3. Persist to API so it doesn't get wiped by fetchBalancesFromAPI
    saveWorkerBalanceToAPI(newBalanceProfile.id, newBalanceProfile).catch(err => {
      console.warn("Failed to persist new worker balance to API", err);
    });
  };

  return {
    balancesData,
    setBalancesData,
    handleAddWorker
  };
}
