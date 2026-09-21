import { useEffect, useState } from 'react';

// La hora actual, refrescada cada `cadaMs`: para mostrar cosas que avanzan solas
// (cuánto lleva alguien fichado) sin que cada componente monte su propio reloj.
export function useAhora(cadaMs = 30000) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
