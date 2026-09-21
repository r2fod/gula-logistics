import { useEffect, useRef } from 'react';

// Ventanas abiertas, de la más antigua a la más reciente: con Escape solo se
// cierra la de arriba (p. ej. el editor de fichaje abierto sobre el informe de
// nóminas).
const abiertas = [];

// Llama a `onCerrar` al pulsar Escape mientras `activo` sea true y esta sea la
// última ventana abierta. Lo usan Modal y el menú lateral del panel.
export function useCerrarConEscape(activo, onCerrar) {
  // Guardar el último `onCerrar` evita volver a suscribirse en cada render (los
  // llamadores suelen pasar una flecha nueva cada vez).
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    if (!activo) return undefined;

    const yo = {};
    abiertas.push(yo);

    const alPulsarTecla = (evento) => {
      if (evento.key !== 'Escape' || abiertas[abiertas.length - 1] !== yo) return;
      alCerrar.current?.();
    };
    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      abiertas.splice(abiertas.indexOf(yo), 1);
    };
  }, [activo]);
}
