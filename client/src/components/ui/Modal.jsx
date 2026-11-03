import React, { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useCerrarConEscape } from '../../hooks/useCerrarConEscape';
import BotonCerrar from './BotonCerrar';

// Las clases van completas para que Tailwind las detecte.
const ANCHOS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  // Casi todo el ancho de la pantalla (hasta 1600 px): editores con mucho contenido.
  amplio: 'max-w-[min(96vw,1600px)]',
};

const CAPAS = { 50: 'z-50', 60: 'z-[60]', 100: 'z-[100]' };

const DISPOSICIONES = {
  // El contenido hace scroll dentro del panel; la X, fuera de ese scroll, se queda
  // siempre a la vista (antes subía con el contenido y había que volver arriba).
  pagina: {
    fondo: 'p-3 sm:p-4',
    panel: 'rounded-2xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden',
    cuerpo: 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-7',
  },
  // Cabecera fija + cuerpo con scroll propio: los monta el llamador.
  columna: {
    fondo: 'p-1 sm:p-4',
    panel: 'rounded-2xl sm:rounded-3xl max-h-[94vh] flex flex-col',
  },
};

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Al abrir, el foco entra en la ventana (salvo que algo de dentro ya lo tenga, p. ej. un
// autoFocus); Tab da la vuelta dentro de ella y al cerrar vuelve a donde estaba. Antes el
// foco se quedaba detrás: Tab recorría la página de debajo. Sin `etiqueta`, el diálogo toma
// como nombre su primer título (lo que lee un lector de pantalla al abrirla).
function useFocoDentro(abierto, panelRef, nombrarConTitulo) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!abierto || !panel) return undefined;
    const antes = document.activeElement;
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    if (nombrarConTitulo) {
      const titulo = panel.querySelector('h1, h2, h3');
      if (titulo) {
        if (!titulo.id) titulo.id = `titulo-ventana-${Math.random().toString(36).slice(2, 9)}`;
        panel.setAttribute('aria-labelledby', titulo.id);
      }
    }
    const alPulsar = (e) => {
      // `defaultPrevented`: una ventana abierta DENTRO de esta (la flota en el editor) ya lo movió.
      if (e.key !== 'Tab' || e.defaultPrevented || !panel.contains(document.activeElement) && document.activeElement !== panel) return;
      const lista = [...panel.querySelectorAll(ENFOCABLES)].filter(el => !el.closest('[hidden], [aria-hidden="true"]'));
      if (!lista.length) { e.preventDefault(); return; }
      const [primero, ultimo] = [lista[0], lista[lista.length - 1]];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    panel.addEventListener('keydown', alPulsar);
    return () => {
      panel.removeEventListener('keydown', alPulsar);
      if (antes && typeof antes.focus === 'function' && document.contains(antes)) antes.focus({ preventScroll: true });
    };
  }, [abierto, panelRef, nombrarConTitulo]);
}

// Ventana modal base de la app: velo oscuro (sin desenfoque: recalcularlo en cada
// fotograma hacía el scroll de las ventanas a trompicones), panel centrado, botón de
// cerrar, cierre con Escape (solo el modal de arriba) y bloqueo del scroll del
// fondo. Cada modal aporta su contenido; aquí vive todo lo demás.
//
// Props:
// - abierto: false no pinta nada (por defecto true; los modales con estado
//   propio suelen devolver `null` antes de llegar aquí).
// - onCerrar: se llama con el botón "X" y con Escape.
// - ancho: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'amplio'.
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
  const panelRef = useRef(null);

  useCerrarConEscape(abierto && cerrarConEscape, onCerrar);
  useFocoDentro(abierto, panelRef, !etiqueta);

  if (!abierto) return null;

  const { fondo, panel, cuerpo = null } = DISPOSICIONES[disposicion] || DISPOSICIONES.pagina;

  return (
    <div className={`fixed inset-0 ${CAPAS[capa] || CAPAS[50]} flex items-center justify-center ${fondo} bg-slate-950/85 animate-fadeIn`}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        className={`relative w-full outline-none ${ANCHOS[ancho] || ANCHOS.md} bg-slate-900 border border-slate-800 shadow-2xl text-white animate-entrarVentana motion-reduce:animate-none ${panel} ${cuerpo ? '' : className}`}
      >
        {botonCerrar && <BotonCerrar onClick={onCerrar} className="absolute top-4 right-4 z-10 bg-slate-900/90 sm:top-5 sm:right-5" />}
        {cuerpo ? <div className={`${cuerpo} ${className}`}>{children}</div> : children}
      </div>
    </div>
  );
}
