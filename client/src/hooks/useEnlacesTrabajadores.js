import { useCallback, useEffect, useState } from 'react';
import { crearEnlacesTrabajadoresEnAPI } from '../data/apiService';
import { fichaDePersona } from '../data/nombresTrabajadores';

// Enlaces firmados de los trabajadores (con ellos cada uno ve SU saldo), para el admin.
//
// const { tokenDe, cargando, error, generar } = useEnlacesTrabajadores(esAdmin);
// - Con `activo` los pide al montarse, así copiar después es inmediato (el
//   portapapeles de Safari no deja copiar tras esperar a la red).
// - tokenDe(nombre, equipo) → el token de esa persona del equipo (su ficha de Saldos
//   puede llamarse distinto: "Marta Gula" / "Marta"; `equipo`, los nombres de todos, para
//   que una ficha sea de quien más se le parece), o null (sin ficha, o aún cargando: el
//   enlace sale sin saldo). fichaDe(nombre, equipo) → { id, name, token } de esa ficha.
// - generar({ anularAnteriores: true }) deja sin efecto todos los ya enviados y
//   trae los nuevos.
const aEstado = (r) => (r.ok
  ? { enlaces: r.enlaces, cargando: false, error: '' }
  : { enlaces: [], cargando: false, error: r.error });

export function useEnlacesTrabajadores(activo) {
  const [estado, setEstado] = useState(() => ({ enlaces: [], cargando: !!activo, error: '' }));

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    crearEnlacesTrabajadoresEnAPI().then(r => { if (vigente) setEstado(aEstado(r)); });
    return () => { vigente = false; };
  }, [activo]);

  const generar = useCallback(async ({ anularAnteriores = false } = {}) => {
    setEstado(e => ({ ...e, cargando: true, error: '' }));
    const r = await crearEnlacesTrabajadoresEnAPI({ anularAnteriores });
    setEstado(aEstado(r));
    return r.ok;
  }, []);

  // `equipo`: los nombres de todo el equipo (una ficha es de quien más se le parece).
  const fichaDe = useCallback(
    (nombre, equipo = []) => fichaDePersona(nombre, estado.enlaces, equipo) || null,
    [estado.enlaces]
  );
  const tokenDe = useCallback((nombre, equipo = []) => fichaDe(nombre, equipo)?.token || null, [fichaDe]);

  return { tokenDe, fichaDe, cargando: estado.cargando, error: estado.error, generar };
}
