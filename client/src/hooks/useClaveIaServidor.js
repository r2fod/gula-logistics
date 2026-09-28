import { useEffect, useState } from 'react';
import { comprobarClaveIaEnServidor } from '../data/apiService';

// Si el servidor tiene clave de Gemini (GEMINI_API_KEY en Render), para decírselo
// al admin junto al campo de la clave. Se pregunta al abrir; null = no se sabe.
export function useClaveIaServidor(activo = true) {
  const [enServidor, setEnServidor] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    comprobarClaveIaEnServidor().then(r => { if (vigente) setEnServidor(r); });
    return () => { vigente = false; };
  }, [activo]);
  return enServidor;
}
