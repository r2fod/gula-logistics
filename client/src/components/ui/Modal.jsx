import React, { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import BotonCerrar from './BotonCerrar';

// Modales abiertos, del más antiguo al más reciente: con Escape solo se cierra
// el de arriba (p. ej. el editor de fichaje abierto sobre el informe de nóminas).
const modalesAbiertos = [];

// Las clases van completas para que Tailwind las detecte.
const ANCHOS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
};

const CAPAS = { 50: 'z-50', 60: 'z-[60]', 100: 'z-[100]' };

const DISPOSICIONES = {
  // Todo el contenido hace scroll dentro del panel.
  pagina: {
    fondo: 'p-3 sm:p-4',
    panel: 'rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-h-[92vh] overflow-y-auto',
  },
  // Cabecera fija + cuerpo con scroll propio: los monta el llamador.
  columna: {
    fondo: 'p-1 sm:p-4',
    panel: 'rounded-2xl sm:rounded-3xl max-h-[94vh] flex flex-col',
  },
};

// Ventana modal base de la app: fondo con desenfoque, panel centrado, botón de
// cerrar, cierre con Escape (solo el modal de arriba) y bloqueo del scroll del
// fondo. Cada modal aporta su contenido; aquí vive todo lo demás.
//
// Props:
// - abierto: false no pinta nada (por defecto true; los modales con estado
//   propio suelen devolver `null` antes de llegar aquí).
// - onCerrar: se llama con el botón "X" y con Escape.
// - ancho: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl'.
// - capa: 50 | 60 | 100 (z-index; 60 y 100 para los que salen sobre otro modal).
// - disposicion: 'pagina' (por defecto) | 'columna'.
// - botonCerrar: false si el modal pinta su propio <BotonCerrar> en la cabecera.
// - cerrarConEscape: false para desactivar Escape.
// - etiqueta: nombre accesible del diálogo.
// - className: clases extra del panel (p. ej. "overflow-x-hidden").
export default function Modal({
  abierto = true,
  onCerrar,
  ancho = 'md',
  capa = 50,
  disposicion = 'pagina',
  botonCerrar = true,
  cerrarConEscape = true,
  etiqueta,
  className = '',
  children,
}) {
  useBodyScrollLock(abierto);

  // Guardar el último `onCerrar` evita re-suscribir el listener en cada render
  // (los llamadores suelen pasar una flecha nueva cada vez).
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    if (!abierto || !cerrarConEscape) return undefined;

    const yo = {};
    modalesAbiertos.push(yo);

    const alPulsarTecla = (evento) => {
      if (evento.key !== 'Escape' || modalesAbiertos[modalesAbiertos.length - 1] !== yo) return;
      alCerrar.current?.();
    };
    document.addEventListener('keydown', alPulsarTecla);

    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      modalesAbiertos.splice(modalesAbiertos.indexOf(yo), 1);
    };
  }, [abierto, cerrarConEscape]);

  if (!abierto) return null;

  const { fondo, panel } = DISPOSICIONES[disposicion] || DISPOSICIONES.pagina;

  return (
    <div className={`fixed inset-0 ${CAPAS[capa] || CAPAS[50]} flex items-center justify-center ${fondo} bg-slate-950/80 backdrop-blur-md animate-fadeIn`}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        className={`relative w-full ${ANCHOS[ancho] || ANCHOS.md} bg-slate-900 border border-slate-800 shadow-2xl text-white ${panel} ${className}`}
      >
        {botonCerrar && <BotonCerrar onClick={onCerrar} className="absolute top-5 right-5" />}
        {children}
      </div>
    </div>
  );
}
