import React from 'react';
import { Truck, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useCerrarConEscape } from '../../hooks/useCerrarConEscape';
import BotonAccion from './BotonAccion';
import { SECCIONES_MENU, accionesDe } from './acciones';

// Menú lateral del móvil y la tablet (se desliza desde la derecha): estado de la
// sesión y todas las acciones del panel agrupadas por sección. Cada acción cierra
// el menú al pulsarla.
//
// Props: abierto, onCerrar, acciones (de `crearAcciones`), adminUnlocked,
// onSalir y onDesbloquear (cerrar la sesión de admin / pedir el acceso).
export default function MenuLateral({ abierto, onCerrar, acciones, adminUnlocked, onSalir, onDesbloquear }) {
  useBodyScrollLock(abierto);
  useCerrarConEscape(abierto, onCerrar);

  if (!abierto) return null;

  const delMenu = accionesDe(acciones, 'menu');

  return (
    <div role="dialog" aria-modal="true" aria-label="Menú de Gestión" className="fixed inset-0 z-50 lg:hidden flex justify-end">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onCerrar} />

      <div className="relative w-full max-w-xs bg-slate-900 border-l border-slate-800 h-full p-5 flex flex-col justify-between shadow-2xl overflow-y-auto z-10">
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white font-['Outfit']">Menú de Gestión</h3>
                <p className="text-[10px] text-slate-400">Herramientas & Ajustes</p>
              </div>
            </div>
            <button onClick={onCerrar} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white" aria-label="Cerrar Menú">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Modo de Acceso</span>
              <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                {adminUnlocked ? 'Administrador' : 'Socias / Lectura'}
              </span>
            </div>
            {adminUnlocked ? (
              <button
                onClick={() => { onSalir(); onCerrar(); }}
                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30"
              >
                Salir
              </button>
            ) : (
              <button
                onClick={() => { onDesbloquear(); onCerrar(); }}
                className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-amber-500 text-slate-950 shadow-md"
              >
                Desbloquear
              </button>
            )}
          </div>

          <div className="space-y-4">
            {SECCIONES_MENU.map((seccion) => {
              const deLaSeccion = delMenu.filter((accion) => accion.seccion === seccion.id);
              if (deLaSeccion.length === 0) return null;
              return (
                <div key={seccion.id}>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">{seccion.titulo}</h4>
                  <div className="space-y-1.5">
                    {deLaSeccion.map((accion) => (
                      <BotonAccion key={accion.id} accion={accion} variante="menu" alPulsar={onCerrar} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 block">Gula Logística · v2.5 Mobile</span>
        </div>
      </div>
    </div>
  );
}
