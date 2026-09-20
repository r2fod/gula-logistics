import { useState } from 'react';
import { initialBalancesData } from '../data/balancesData';
import { saveWorkerBalanceToAPI, hasRealBalancesData } from '../data/apiService';

// Antes esto leía y escribía en 'gula_balances_v1', una clave DISTINTA de
// 'gula_balances_data_v1' que usa fetchBalancesFromAPI (apiService.js) para
// cachear la respuesta real de cada fetch. 'gula_balances_v1' solo se
// actualizaba al añadir un trabajador localmente (handleAddWorker) — nunca
// en cada fetch exitoso — así que el estado inicial de la app (antes de
// que resuelva el primer fetch) podía leer una caché mucho más vieja que
// la que sí se mantenía al día. Unificado a una sola clave.
const BALANCES_CACHE_KEY = 'gula_balances_data_v1';

export function useBalances(workersList, setWorkersList) {
  const [balancesData, setBalancesData] = useState(() => {
    try {
      const saved = localStorage.getItem(BALANCES_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (hasRealBalancesData(parsed)) {
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
    localStorage.setItem(BALANCES_CACHE_KEY, JSON.stringify(updatedBalances));

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
