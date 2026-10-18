import React from 'react';
import { ShieldCheck, KeyRound, LogOut, Truck, Menu, MoreHorizontal } from 'lucide-react';
import { esBorrador } from '../../data/anticipacion';
import BotonAccion from './BotonAccion';
import { accionesDe } from './acciones';
import { Selector } from '../ui/Campo';

// Cabecera del panel de control: título con el estado de la sesión, selector de
// semana y las acciones (barra de escritorio o barra rápida del móvil + "Menú").
//
// Props:
// - adminUnlocked: hay sesión de administrador.
// - activeWeekData / allWeeks / activeWeekId / onSelectWeek: semana que se ve y cómo cambiarla.
// - acciones: la lista de `crearAcciones`.
// - onSalir / onDesbloquear: cerrar la sesión de admin o pedir el acceso.
// - onAbrirMenu: abre el menú lateral ("Menú" en el móvil, "Más" en el ordenador), donde
//   están TODAS las acciones, también las que no caben en la barra (Memoria IA, borrador…).
export default function CabeceraPanel({
  adminUnlocked,
  activeWeekData,
  allWeeks = {},
  activeWeekId,
  onSelectWeek,
  acciones,
  onSalir,
  onDesbloquear,
  onAbrirMenu,
}) {
  const claves = accionesDe(acciones, 'cabecera').find((a) => a.id === 'claves');
  const nuevaSemana = accionesDe(acciones, 'cabecera').find((a) => a.id === 'nuevaSemana');

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xl flex flex-col gap-3 w-full max-w-full overflow-hidden">
      {/* Fila superior: título y selector de semana */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full">
        <div className="flex items-center gap-2.5 min-w-0 max-w-full">
          <div className="icono-camion w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {/* Móvil: título y subtítulo a la izquierda (ADMIN delante del subtítulo) y Clave y
                Salir, cuadrados e iguales, a la derecha: todo en el alto de dos líneas (antes,
                tres líneas y tres piezas de tamaños distintos). Desde sm, todo en una fila con el
                subtítulo debajo. Cada pieza lleva su sitio en la rejilla del móvil; desde sm esas
                clases no cuentan. */}
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-1.5 gap-y-0.5 sm:flex sm:flex-wrap sm:gap-y-0">
              <h1 className="col-span-2 col-start-1 row-start-1 min-w-0 truncate text-[11px] min-[400px]:text-xs sm:text-base font-extrabold text-white tracking-tight font-outfit">
                Panel de Control Gula Logística
              </h1>
              {adminUnlocked ? (
                <>
                  <span className="col-start-1 row-start-2 inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2 text-[10px] font-extrabold text-slate-950 sm:h-6 sm:text-[11px]">
                    <ShieldCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span>ADMIN</span>
                  </span>
                  {claves && (
                    <div className="col-start-3 row-span-2 row-start-1 flex sm:contents">
                      <BotonAccion accion={claves} variante="cabecera" />
                    </div>
                  )}
                  <button
                    onClick={onSalir}
                    aria-label="Salir"
                    title="Cerrar la sesión de administrador"
                    className="col-start-4 row-span-2 row-start-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] font-bold text-rose-400 transition-colors hover:bg-rose-500/20 sm:h-6 sm:w-auto sm:gap-1 sm:rounded-full sm:px-2"
                  >
                    <LogOut className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Salir</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onDesbloquear}
                  className="col-span-2 col-start-3 row-span-2 row-start-1 flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/20 px-3 text-[11px] font-bold text-blue-300 transition-colors hover:bg-blue-500/30 sm:h-6 sm:rounded-full sm:px-2"
                >
                  <KeyRound className="w-3 h-3 text-blue-400" />
                  <span>Admin Login</span>
                </button>
              )}
              <p className={`min-w-0 truncate text-[11px] text-slate-500 sm:basis-full sm:overflow-visible sm:whitespace-normal ${adminUnlocked ? 'col-start-2' : 'col-span-2 col-start-1'} row-start-2`}>
                {activeWeekData?.meta?.week || 'Semana 3'} · {activeWeekData?.meta?.dateRange}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <Selector
            value={activeWeekId}
            onChange={(e) => onSelectWeek(e.target.value)}
            tamano="2xs" texto="ambar" className="min-w-0 max-w-full flex-1 sm:flex-none sm:max-w-xs truncate"
          >
            {/* El valor es la CLAVE de la semana: la semana 3 no lleva campo `id`, y con `w.id` su
                opción valía "undefined" y al elegirla se abría la semana de ejemplo. */}
            {Object.entries(allWeeks).map(([id, w]) => (
              <option key={id} value={id}>{w.name} ({w.meta?.dateRange}){esBorrador(w) ? ' — BORRADOR' : ''}</option>
            ))}
          </Selector>
          {nuevaSemana && <BotonAccion accion={nuevaSemana} variante="cabecera" />}
        </div>
      </div>

      {/* Barra rápida del móvil y la tablet: las acciones principales y el menú */}
      <div className="flex lg:hidden items-center justify-between w-full pt-2 border-t border-slate-800/80 mt-1">
        <div className="flex items-center gap-2">
          {accionesDe(acciones, 'movil').map((accion) => (
            <BotonAccion key={accion.id} accion={accion} variante="movil" />
          ))}
        </div>

        <button
          onClick={onAbrirMenu}
          className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow-md active:scale-95 transition-all shrink-0"
          aria-label="Abrir Menú"
        >
          <Menu className="w-4 h-4 text-amber-400" />
          <span className="whitespace-nowrap">Menú</span>
        </button>
      </div>

      {/* Barra de acciones de escritorio. Si no cabe (1024 px, letra grande) baja a otra
          línea: antes se cortaba por los dos lados y "Fichar" quedaba fuera de alcance. "Más"
          abre el menú lateral: en el ordenador era la única forma de llegar a Memoria IA
          (el grafo de conocimiento) o al borrador manual, y no había botón para abrirlo. */}
      <div className="hidden lg:flex flex-wrap items-center justify-center gap-1 xl:gap-1.5 w-full pt-2 border-t border-slate-800/80">
        {accionesDe(acciones, 'barra').map((accion) => (
          <BotonAccion key={accion.id} accion={accion} variante="barra" />
        ))}
        <button
          type="button"
          onClick={onAbrirMenu}
          title="Más opciones: Memoria IA, borrador manual, claves…"
          aria-label="Más opciones"
          className="px-1.5 xl:px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 xl:gap-1.5 transition-all shrink-0 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold border border-slate-800"
        >
          <MoreHorizontal className="w-3.5 h-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="hidden xl:inline whitespace-nowrap">Más</span>
        </button>
      </div>
    </header>
  );
}
