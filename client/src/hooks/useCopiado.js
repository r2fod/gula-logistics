import { useCallback, useEffect, useRef, useState } from 'react';

// Copiar al portapapeles y enseñar "¡Copiado!" unos segundos.
//
// const [copiado, copiar] = useCopiado();
// copiar(texto)            -> copiado pasa a true durante 3 s
// copiar(texto, 'Ana')     -> copiado pasa a 'Ana' (para listas: `copiado === nombre`)
//
// Si el navegador no deja copiar, no marca nada (mejor que decir "copiado"
// sin haberlo hecho). Devuelve una promesa con true/false.
export function useCopiado(duracionMs = 3000) {
  const [copiado, setCopiado] = useState(null);
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const copiar = useCallback(async (texto, marca = true) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return false;
    }
    setCopiado(marca);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(null), duracionMs);
    return true;
  }, [duracionMs]);

  return [copiado, copiar];
}
