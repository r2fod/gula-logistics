import { useCallback, useEffect, useState } from 'react';
import { crearEnlacesTrabajadoresEnAPI } from '../data/apiService';
import { coincideNombre } from '../data/nombresTrabajadores';

// Enlaces firmados de los trabajadores (con ellos cada uno ve SU saldo), para el admin.
//
// const { tokenDe, cargando, error } = useEnlacesTrabajadores(esAdmin);
// - Con `activo` los pide al montarse, así copiar después es inmediato (el
//   portapapeles de Safari no deja copiar tras esperar a la red).
// - tokenDe(nombre) → el token de esa persona del equipo (su ficha de Saldos puede
//   llamarse distinto: "Marta Gula" / "Marta"), o null (sin ficha, o aún cargando: el
//   enlace sale sin saldo, igual que antes).
export function useEnlacesTrabajadores(activo) {
  const [estado, setEstado] = useState(() => ({ enlaces: [], cargando: !!activo, error: '' }));

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    crearEnlacesTrabajadoresEnAPI().then(r => {
      if (vigente) setEstado(r.ok ? { enlaces: r.enlaces, cargando: false, error: '' } : { enlaces: [], cargando: false, error: r.error });
    });
    return () => { vigente = false; };
  }, [activo]);

  const tokenDe = useCallback(
    (nombre) => estado.enlaces.find(e => coincideNombre(nombre, e.name))?.token || null,
    [estado.enlaces]
  );

  return { tokenDe, cargando: estado.cargando, error: estado.error };
}
