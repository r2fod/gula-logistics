import { useEffect, useState } from 'react';
import { fetchMiSaldoFromAPI, olvidarTokenTrabajador, tokenTrabajador } from '../data/apiService';
import { coincideNombre } from '../data/nombresTrabajadores';

// Cada cuánto se vuelve a pedir la ficha: lo que el admin apunte en Saldos & Acuerdos
// (un pago, un ajuste) le llega al trabajador en ese tiempo, sin recargar.
export const REFRESCO_SALDO_MS = 20 * 1000;

// La ficha de Saldos de `nombre`, si este móvil tiene su enlace firmado.
// { ficha, sinEnlace }: sinEnlace = no lo tiene (enlace antiguo, o anulado/caducado).
// Sin red se queda con lo último que llegó (caché local).
const CACHE_KEY = 'gula_mi_saldo_v1';

export function useMiSaldo(nombre) {
  const [estado, setEstado] = useState(() => {
    let fichaCache = null;
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) fichaCache = JSON.parse(saved);
    } catch {}
    
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
          localStorage.setItem(CACHE_KEY, JSON.stringify(fichaValida));
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
        setEstado({ ficha: fichaValida, sinEnlace: false });
      } else if (r.status === 401) {
        // Anulado o caducado: se olvida y deja de preguntar. Un 404 NO (servidor aún sin
        // esta ruta mientras se despliega, o ficha borrada): se sigue con lo que hubiera.
        olvidarTokenTrabajador();
        localStorage.removeItem(CACHE_KEY);
        setEstado({ ficha: null, sinEnlace: true });
      }
    };
    pedir();
    const id = setInterval(pedir, REFRESCO_SALDO_MS);
    return () => { vigente = false; clearInterval(id); };
  }, [nombre]);

  return estado;
}
