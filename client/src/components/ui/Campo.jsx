import React, { useId } from 'react';

// Las clases van completas para que Tailwind las detecte.
const TAMANOS = {
  xl: 'p-4 text-sm',
  lg: 'px-4 py-3 text-sm',
  md: 'px-4 py-2.5 text-xs',
  sm: 'px-3 py-2 text-xs',
  xs: 'p-2 text-xs',
  '2xs': 'px-3 py-1.5 text-xs',
};

const REDONDEOS = { lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl' };
// Radio de cada tamaño si no se pide otro.
const REDONDEO_POR_TAMANO = { xl: 'xl', lg: 'xl', md: 'xl', sm: 'xl', xs: 'lg', '2xs': 'xl' };

// Color del borde al enfocar.
const ACENTOS = {
  amber: 'focus:border-amber-500',
  'amber-suave': 'focus:border-amber-500/60',
  emerald: 'focus:border-emerald-500',
  blue: 'focus:border-blue-500',
  rose: 'focus:border-rose-500',
};

const FONDOS = { oscuro: 'bg-slate-950', medio: 'bg-slate-900' };
const BORDES = { normal: 'border-slate-800', marcado: 'border-slate-700' };
const TEXTOS = {
  blanco: 'text-white',
  suave: 'text-slate-300',
  destacado: 'text-amber-300 font-bold',
  ambar: 'text-amber-400 font-bold',
};

// Clases de un campo de formulario (input, select o textarea). Se exporta por
// si algún elemento necesita las mismas clases sin ser uno de estos componentes.
//
// - tamano: 'xl' (áreas de texto grandes) | 'lg' | 'md' | 'sm' | 'xs' | '2xs' (barras de filtros)
// - redondeo: 'lg' | 'xl' | '2xl' (por defecto, el que corresponde al tamaño)
// - acento: color del borde al enfocar (ver ACENTOS)
// - fondo: 'oscuro' (slate-950, sobre paneles) | 'medio' (slate-900, sobre tarjetas oscuras)
// - borde: 'normal' | 'marcado'
// - texto: 'blanco' | 'suave' | 'destacado' (ámbar claro y negrita: contraseñas) | 'ambar' (ámbar y negrita: importes)
export function claseCampo({ tamano = 'lg', redondeo, acento = 'amber', fondo = 'oscuro', borde = 'normal', texto = 'blanco' } = {}) {
  const tamanoValido = TAMANOS[tamano] ? tamano : 'lg';
  return [
    FONDOS[fondo] || FONDOS.oscuro,
    'border',
    BORDES[borde] || BORDES.normal,
    TAMANOS[tamanoValido],
    REDONDEOS[redondeo] || REDONDEOS[REDONDEO_POR_TAMANO[tamanoValido]],
    TEXTOS[texto] || TEXTOS.blanco,
    ACENTOS[acento] || ACENTOS.amber,
    'placeholder-slate-500 focus:outline-none',
  ].join(' ');
}

// Los tres controles reciben los mismos props de estilo y reenvían el resto al
// elemento nativo (value, onChange, placeholder, required, disabled...).
// `className` sustituye a "w-full" (por defecto): quien lo pase pone su propio
// ancho ("flex-1 min-w-0", "w-20 shrink-0"...). Solo para ancho y disposición:
// el relleno, el tamaño de letra y los colores se piden con las props de arriba
// (dos clases de relleno a la vez se pisan según el orden del CSS, no del JSX).
function crearControl(Elemento, nombre, claseExtra = '') {
  const Control = React.forwardRef(function Control(
    { tamano, redondeo, acento, fondo, borde, texto, className = 'w-full', ...resto },
    ref
  ) {
    return (
      <Elemento
        ref={ref}
        className={`${claseCampo({ tamano, redondeo, acento, fondo, borde, texto })} ${claseExtra} ${className}`.replace(/\s+/g, ' ').trim()}
        {...resto}
      />
    );
  });
  Control.displayName = nombre;
  return Control;
}

export const Input = crearControl('input', 'Input');
export const Selector = crearControl('select', 'Selector');
export const AreaTexto = crearControl('textarea', 'AreaTexto');

// Etiqueta + control (+ ayuda o error debajo). Los hijos son el control, que
// puede ser cualquiera de los de arriba.
//
// - etiqueta: texto de la etiqueta; `icono` (componente lucide) opcional delante.
// - colorIcono: clase de color del icono.
// - compacta: etiqueta pequeña, sin mayúsculas ni negrita (listas de campos densas).
// - ayuda: texto pequeño bajo el control.
export function Campo({ etiqueta, icono: Icono = null, colorIcono = 'text-amber-400', compacta = false, ayuda = null, className = '', children }) {
  // Une la etiqueta con el control (accesibilidad y clic en la etiqueta) sin
  // que el llamador tenga que inventarse un id.
  const idAutomatico = useId();
  const esControl = React.isValidElement(children);
  const idControl = (esControl && children.props.id) || idAutomatico;
  const control = esControl && children.props.id === undefined
    ? React.cloneElement(children, { id: idControl })
    : children;

  return (
    <div className={className}>
      {etiqueta && (
        <label htmlFor={idControl} className={compacta
          ? 'block text-[11px] font-medium text-slate-400 mb-1'
          : 'flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2'}
        >
          {Icono && <Icono className={`w-3.5 h-3.5 ${colorIcono}`} aria-hidden="true" />}
          <span>{etiqueta}</span>
        </label>
      )}
      {control}
      {ayuda && <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">{ayuda}</p>}
    </div>
  );
}
