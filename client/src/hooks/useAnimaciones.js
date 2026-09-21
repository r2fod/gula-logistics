import { useEffect, useRef, useState } from 'react';

// Animaciones sin librerías: requestAnimationFrame + transiciones de Tailwind.
// Quien tiene activado "reducir movimiento" en su sistema (y los entornos sin
// matchMedia, como los tests) ve los valores finales al instante.
export function movimientoReducido() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Número que "corre" hasta su valor: al aparecer sube desde 0 y, cuando cambia
// (otro periodo), sigue desde donde estaba en vez de saltar. Ease-out cúbico.
export function useCountUp(objetivo, duracion = 700) {
  const meta = Number.isFinite(objetivo) ? objetivo : 0;
  const [valor, setValor] = useState(() => (movimientoReducido() ? meta : 0));
  const actual = useRef(valor);

  useEffect(() => {
    if (movimientoReducido()) {
      actual.current = meta;
      setValor(meta);
      return undefined;
    }
    const desde = actual.current;
    const inicio = performance.now();
    let id;
    const paso = () => {
      const p = Math.min(1, (performance.now() - inicio) / duracion);
      const v = p >= 1 ? meta : desde + (meta - desde) * (1 - Math.pow(1 - p, 3));
      actual.current = v;
      setValor(v);
      if (p < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [meta, duracion]);

  return valor;
}

// false en el primer pintado y true en el siguiente: sirve para que una barra
// nazca a 0 y crezca (transición CSS de `width`) hasta su tamaño.
export function useEntrada() {
  const [listo, setListo] = useState(() => movimientoReducido());
  useEffect(() => {
    if (listo) return undefined;
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, [listo]);
  return listo;
}
