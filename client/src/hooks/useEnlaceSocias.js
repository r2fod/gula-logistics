import { useCallback, useEffect, useState } from 'react';
import { crearTokenSociasEnAPI } from '../data/apiService';
import { enlaceSocias } from '../data/enlaces';

// Enlace de socias de SOLO LECTURA, generado por el servidor para el admin.
//
// const { enlace, caduca, cargando, error, generar } = useEnlaceSocias(esAdmin);
// - Con `activo` pide uno al montarse (así copiarlo después es inmediato: el
//   portapapeles de Safari no deja copiar tras esperar a la red).
// - generar({ anularAnteriores: true }) deja sin efecto todos los ya enviados.
const aEstado = (r) => (r.ok
  ? { enlace: enlaceSocias(r.token), caduca: r.expiresAt, cargando: false, error: '' }
  : { enlace: null, caduca: null, cargando: false, error: r.error });

export function useEnlaceSocias(activo) {
  const [estado, setEstado] = useState(() => ({ enlace: null, caduca: null, cargando: !!activo, error: '' }));

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true; // si se desmonta antes de responder, no se toca el estado
    crearTokenSociasEnAPI({ anularAnteriores: false }).then(r => { if (vigente) setEstado(aEstado(r)); });
    return () => { vigente = false; };
  }, [activo]);

  const generar = useCallback(async ({ anularAnteriores = false } = {}) => {
    setEstado(e => ({ ...e, cargando: true, error: '' }));
    const r = await crearTokenSociasEnAPI({ anularAnteriores });
    setEstado(aEstado(r));
    return r.ok;
  }, []);

  return { ...estado, generar };
}
