import { useEffect, useState } from 'react';
import { fetchMiSaldoFromAPI, olvidarTokenTrabajador, tokenTrabajador } from '../data/apiService';
import { coincideNombre, normalizarNombre } from '../data/nombresTrabajadores';

// Cada cuánto se vuelve a pedir la ficha: lo que el admin apunte en Saldos & Acuerdos
// (un pago, un ajuste) le llega al trabajador en ese tiempo, sin recargar.
export const REFRESCO_SALDO_MS = 20 * 1000;

export function useMiSaldo(nombre) {
  const cacheKey = `gula_mi_saldo_v1_${normalizarNombre(nombre)}`;

  const [estado, setEstado] = useState(() => {
    let fichaCache = null;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) fichaCache = JSON.parse(saved);
    } catch { /* sin almacenamiento o copia ilegible: se pide al servidor */ }
    
    return { 
      ficha: fichaCache && coincideNombre(nombre, fichaCache.name) ? fichaCache : null, 
      sinEnlace: !tokenTrabajador(nombre) 
    };
  });

  useEffect(() => {
    let vigente = true;
    const pedir = async () => {
      const token = tokenTrabajador(nombre);
      if (!token) return;
      const r = await fetchMiSaldoFromAPI(token);
      if (!vigente) return;
      if (r.ok) {
        // Por si acaso: solo se enseña si la ficha es de esta persona.
        const fichaValida = coincideNombre(nombre, r.ficha?.name) ? r.ficha : null;
        if (fichaValida) {
          localStorage.setItem(cacheKey, JSON.stringify(fichaValida));
        } else {
          localStorage.removeItem(cacheKey);
        }
        setEstado({ ficha: fichaValida, sinEnlace: false, sinFicha: !fichaValida });
      } else if (r.status === 401) {
        // Anulado o caducado: se olvida y deja de preguntar. Un 404 NO (servidor aún sin
        // esta ruta mientras se despliega, o ficha borrada): se sigue con lo que hubiera.
        olvidarTokenTrabajador(nombre);
        localStorage.removeItem(cacheKey);
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
