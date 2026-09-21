import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Radio, Calendar, Zap, Truck, TrendingUp, Wallet, ClipboardList, Menu } from 'lucide-react';

// Secciones del panel. `corta` es el nombre del atajo de la barra inferior del
// móvil (las que no tienen, solo están en la barra de arriba y en el menú).
const PESTANAS = [
  { id: 'live', etiqueta: 'Actividad en tiempo real', corta: 'En vivo', Icono: Radio, vivo: true },
  { id: 'schedule', etiqueta: 'Cuadrante semanal', corta: 'Cuadrante', Icono: Calendar },
  { id: 'graph', etiqueta: 'Grafo y flujo', corta: 'Grafo', Icono: Zap, hover: 'icono-destello' },
  { id: 'logistics', etiqueta: 'Flota y bodas', Icono: Truck, hover: 'icono-camion' },
  { id: 'balances', etiqueta: 'Saldos y acuerdos', corta: 'Saldos', Icono: TrendingUp },
  { id: 'financial', etiqueta: 'Resumen financiero', Icono: Wallet },
  { id: 'fichajes', etiqueta: 'Historial de fichajes', Icono: ClipboardList, contador: true },
];
const ORDEN_MOVIL = ['live', 'schedule', 'balances', 'graph'];

// Barra de secciones de escritorio y tablet: la pestaña activa lleva una
// "pastilla" que se desliza de una a otra, su icono hace un pequeño pop y la
// barra se desplaza sola para dejarla a la vista cuando no cabe entera.
export function BarraPestanas({ activa, onSeleccionar, contadorFichajes = 0 }) {
  const barra = useRef(null);
  const [marca, setMarca] = useState(null);

  const medir = () => {
    const el = barra.current?.querySelector(`[data-pestana="${activa}"]`);
    if (el) setMarca({ left: el.offsetLeft, width: el.offsetWidth });
    return el;
  };

  useLayoutEffect(() => {
    const el = medir();
    const b = barra.current;
    if (el && b && typeof b.scrollTo === 'function') {
      b.scrollTo({ left: Math.max(0, el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
    }
  }, [activa, contadorFichajes]);

  // Si cambia el ancho de la ventana (o carga la tipografía) la pastilla se recoloca.
  useEffect(() => {
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [activa]);

  return (
    <div
      ref={barra}
      role="tablist"
      aria-label="Secciones del panel"
      className="relative flex items-center gap-1 bg-slate-900/80 p-1.5 sm:p-2 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar w-full max-w-full"
    >
      {marca && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-1.5 sm:inset-y-2 rounded-xl shadow-lg transition-[left,width,background-color,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
            activa === 'live' ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-amber-500 shadow-amber-500/25'
          }`}
          style={{ left: marca.left, width: marca.width }}
        />
      )}
      {PESTANAS.map(({ id, etiqueta, Icono, vivo, hover, contador }) => {
        const esActiva = activa === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={esActiva}
            data-pestana={id}
            onClick={() => onSeleccionar(id)}
            className={`relative z-10 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-colors duration-300 ${hover || ''} ${
              esActiva ? 'text-slate-950 font-extrabold' : 'text-slate-400 font-bold hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <Icono
              key={esActiva ? 'activa' : 'inactiva'}
              className={`w-3.5 h-3.5 ${vivo ? `animate-pulse ${esActiva ? '' : 'text-rose-400'}` : esActiva ? 'animate-pop' : ''}`}
              aria-hidden="true"
            />
            <span>{etiqueta}</span>
            {contador && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums transition-colors duration-300 ${esActiva ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-300'}`}>
                {contadorFichajes}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Barra inferior del móvil, al alcance del pulgar: un atajo por sección
// principal, una marca que aparece sobre la activa y el acceso al menú.
export function BarraInferior({ activa, onSeleccionar, onAbrirMenu }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl safe-bottom"
    >
      {ORDEN_MOVIL.map(id => {
        const { corta, Icono, vivo } = PESTANAS.find(p => p.id === id);
        const esActiva = activa === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSeleccionar(id)}
            aria-current={esActiva ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-300 ${
              esActiva ? `${vivo ? 'text-emerald-400' : 'text-amber-400'} font-extrabold scale-105` : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {esActiva && <span aria-hidden="true" className={`absolute -top-1.5 h-0.5 w-8 rounded-full animate-aparecer ${vivo ? 'bg-emerald-400' : 'bg-amber-400'}`} />}
            <Icono
              key={esActiva ? 'activa' : 'inactiva'}
              className={`w-5 h-5 mb-0.5 ${vivo ? `animate-pulse ${esActiva ? '' : 'text-rose-400'}` : esActiva ? 'animate-pop' : ''}`}
              aria-hidden="true"
            />
            <span className="text-[10px]">{corta}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAbrirMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-amber-400 transition-all"
      >
        <Menu className="w-5 h-5 mb-0.5" aria-hidden="true" />
        <span className="text-[10px]">Menú</span>
      </button>
    </nav>
  );
}
