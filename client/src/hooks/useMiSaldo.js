import { useEffect, useState } from 'react';
import { fetchMiSaldoFromAPI, olvidarTokenTrabajador, tokenTrabajador, MI_SALDO_CACHE_PREFIJO } from '../data/apiService';
import { coincideNombre, normalizarNombre } from '../data/nombresTrabajadores';

// Cada cuánto se vuelve a pedir la ficha: lo que el admin apunte en Saldos & Acuerdos
// (un pago, un ajuste) le llega al trabajador en ese tiempo, sin recargar.
export const REFRESCO_SALDO_MS = 20 * 1000;

export function useMiSaldo(nombre) {
  const cacheKey = `${MI_SALDO_CACHE_PREFIJO}${normalizarNombre(nombre)}`;

  // La copia guardada solo se enseña con el enlace vigente: sin él (caducado, anulado o
  // en un móvil compartido) se borra. Antes se veía un saldo viejo indefinidamente.
  const [estado, setEstado] = useState(() => {
    const sinEnlace = !tokenTrabajador(nombre);
    let fichaCache = null;
    try {
      if (sinEnlace) localStorage.removeItem(cacheKey);
      else fichaCache = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    } catch { /* sin almacenamiento o copia ilegible: se pide al servidor */ }
    return { ficha: fichaCache && coincideNombre(nombre, fichaCache.name) ? fichaCache : null, sinEnlace };
  });

  const guardarCopia = (ficha) => {
    try {
      if (ficha) localStorage.setItem(cacheKey, JSON.stringify(ficha));
      else localStorage.removeItem(cacheKey);
    } catch { /* sin almacenamiento: solo no queda copia */ }
  };

  useEffect(() => {
    let vigente = true;
    const pedir = async () => {
      const token = tokenTrabajador(nombre);
      if (!token) {
        // El enlace caducó mientras estaba abierta: fuera la copia y lo que se enseñaba.
        guardarCopia(null);
        setEstado(e => (e.sinEnlace && !e.ficha ? e : { ficha: null, sinEnlace: true }));
        return;
      }
      const r = await fetchMiSaldoFromAPI(token);
      if (!vigente) return;
      if (r.ok) {
        // Por si acaso: solo se enseña si la ficha es de esta persona.
        const fichaValida = coincideNombre(nombre, r.ficha?.name) ? r.ficha : null;
        guardarCopia(fichaValida);
        setEstado({ ficha: fichaValida, sinEnlace: false, sinFicha: !fichaValida });
      } else if (r.status === 401) {
        // Anulado o caducado: se olvida y deja de preguntar. Un 404 NO (servidor aún sin
        // esta ruta mientras se despliega, o ficha borrada): se sigue con lo que hubiera.
        olvidarTokenTrabajador(nombre);
        guardarCopia(null);
        setEstado({ ficha: null, sinEnlace: true });
      } else if (r.status === 404) {
        // Enlace bueno pero sin ficha (borrada o el servidor a medio desplegar): si no
        // hay copia que enseñar, se le dice en vez de dejar el hueco vacío.
        setEstado(e => (e.ficha ? e : { ...e, sinFicha: true }));
      }
    };
    pedir();
    // Como el resto de la app: con la app en segundo plano no se pregunta (batería y
    // datos) y al volver se pone al día en el momento, sin esperar al siguiente turno.
    const id = setInterval(() => { if (!document.hidden) pedir(); }, REFRESCO_SALDO_MS);
    const alVolver = () => { if (!document.hidden) pedir(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vigente = false; clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
  }, [nombre]);

  return estado;
}
