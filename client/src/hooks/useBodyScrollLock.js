import { useEffect } from 'react';

// Bloquea el scroll del <body> mientras un modal está abierto — sin esto,
// en móvil se podía hacer scroll de la página de detrás a la vez que del
// propio modal por encima, dando saltos raros al llegar al final del
// contenido del modal. Cuenta cuántos modales lo piden a la vez (con
// overlays anidados, p.ej. un modal de confirmación sobre otro modal, no
// se desbloquea hasta que se cierre el último).
let lockCount = 0;
let previousOverflow = '';

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return undefined;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [isLocked]);
}
