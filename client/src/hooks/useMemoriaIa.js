import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAiMemories, addAiMemory, aprobarAiMemory, deleteAiMemory } from '../data/apiService';
import { esMemoriaActiva, esMemoriaPropuesta } from '../data/memoriaIa';

// Reglas a largo plazo del asistente, para el asistente de Gemini, el creador de
// semanas y el panel "Memoria IA" (una sola forma de leerlas y cambiarlas).
//
// const { memorias, activas, propuestas, cargando, anadir, proponer, aprobar, descartar } = useMemoriaIa(abierto);
// Carga al pasar `activo` a true (modal abierto). Todas devuelven la regla o true/false.
export function useMemoriaIa(activo) {
  const [memorias, setMemorias] = useState([]);
  const [cargando, setCargando] = useState(!!activo);

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    getAiMemories().then(lista => {
      if (!vigente) return;
      setMemorias(Array.isArray(lista) ? lista : []);
      setCargando(false);
    });
    return () => { vigente = false; };
  }, [activo]);

  // Sustituye (por _id) o añade al principio: el servidor devuelve la misma
  // regla si ya existía, así que nunca queda repetida en pantalla.
  const guardarEnLista = (regla) => {
    if (!regla?._id) return;
    setMemorias(prev => [regla, ...prev.filter(m => m._id !== regla._id)]);
  };

  const anadir = useCallback(async (texto) => {
    const regla = await addAiMemory(texto.trim(), { estado: 'activa', origen: 'manual' });
    guardarEnLista(regla);
    return regla;
  }, []);

  const proponer = useCallback(async (texto) => {
    const regla = await addAiMemory(texto.trim(), { estado: 'propuesta', origen: 'asistente' });
    guardarEnLista(regla);
    return regla;
  }, []);

  const aprobar = useCallback(async (id) => {
    const regla = await aprobarAiMemory(id);
    if (regla) setMemorias(prev => prev.map(m => (m._id === id ? regla : m)));
    return !!regla;
  }, []);

  const descartar = useCallback(async (id) => {
    const ok = !!(await deleteAiMemory(id));
    if (ok) setMemorias(prev => prev.filter(m => m._id !== id));
    return ok;
  }, []);

  const activas = useMemo(() => memorias.filter(esMemoriaActiva), [memorias]);
  const propuestas = useMemo(() => memorias.filter(esMemoriaPropuesta), [memorias]);

  return { memorias, activas, propuestas, cargando, anadir, proponer, aprobar, descartar };
}
