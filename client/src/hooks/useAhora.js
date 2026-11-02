import { useCallback, useSyncExternalStore } from 'react';

// Reloj vivo compartido: UN solo intervalo por cada `cadaMs`, con todos los que lo
// usan suscritos. Antes cada <EnVivo> montaba su propio setInterval (en el monitor,
// 2N+1 relojes sin sincronizar: los segundos de dos tarjetas no cambiaban a la vez).
// Con la pestaña oculta no avisa a nadie (no hay nada que ver) y al volver se pone
// en hora al momento.
const relojes = new Map(); // cadaMs → { ahora, oyentes, id }

function reloj(cadaMs) {
  let r = relojes.get(cadaMs);
  if (!r) {
    r = { ahora: new Date(), oyentes: new Set(), id: null };
    relojes.set(cadaMs, r);
  }
  return r;
}

const oculta = () => typeof document !== 'undefined' && document.hidden;

function avisar(r) {
  r.ahora = new Date();
  r.oyentes.forEach(oyente => oyente());
}

function suscribir(cadaMs, oyente) {
  const r = reloj(cadaMs);
  r.oyentes.add(oyente);
  if (r.id === null) r.id = setInterval(() => { if (!oculta()) avisar(r); }, cadaMs);
  return () => {
    r.oyentes.delete(oyente);
    if (r.oyentes.size === 0) {
      clearInterval(r.id);
      relojes.delete(cadaMs);
    }
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!oculta()) relojes.forEach(r => { if (r.oyentes.size) avisar(r); });
  });
}

// La hora actual, refrescada cada `cadaMs`: para mostrar cosas que avanzan solas
// (cuánto lleva alguien fichado) sin que cada componente monte su propio reloj.
export function useAhora(cadaMs = 30000) {
  const alta = useCallback((oyente) => suscribir(cadaMs, oyente), [cadaMs]);
  const leer = useCallback(() => reloj(cadaMs).ahora, [cadaMs]);
  return useSyncExternalStore(alta, leer);
}
