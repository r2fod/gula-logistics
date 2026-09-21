import React from 'react';
import { ShieldCheck, KeyRound, Truck, Menu } from 'lucide-react';
import { esBorrador } from '../../data/anticipacion';
import BotonAccion from './BotonAccion';
import { accionesDe } from './acciones';

// Cabecera del panel de control: título con el estado de la sesión, selector de
// semana y las acciones (barra de escritorio o barra rápida del móvil + "Menú").
//
// Props:
// - adminUnlocked: hay sesión de administrador.
// - activeWeekData / allWeeks / activeWeekId / onSelectWeek: semana que se ve y cómo cambiarla.
// - acciones: la lista de `crearAcciones`.
// - onSalir / onDesbloquear: cerrar la sesión de admin o pedir el acceso.
// - onAbrirMenu: abre el menú lateral (móvil y tablet).
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
        <div className="flex items-center gap-2.5 min-w-0 max-w-full flex-wrap sm:flex-nowrap">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-extrabold text-white tracking-tight font-['Outfit'] truncate">
                Panel de Control Gula Logística
              </h1>
              {adminUnlocked ? (
                <>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-amber-500 text-slate-950 flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>ADMIN</span>
                  </span>
                  {claves && <BotonAccion accion={claves} variante="cabecera" />}
                  <button
                    onClick={onSalir}
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Salir</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onDesbloquear}
                  className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 flex items-center gap-1 transition-colors shrink-0"
                >
                  <KeyRound className="w-2.5 h-2.5 text-blue-400" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {activeWeekData?.meta?.week || 'Semana 3'} · {activeWeekData?.meta?.dateRange}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <select
            value={activeWeekId}
            onChange={(e) => onSelectWeek(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-xl text-xs focus:outline-none min-w-0 max-w-full flex-1 sm:flex-none sm:max-w-xs truncate"
          >
            {Object.values(allWeeks).map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.meta?.dateRange}){esBorrador(w) ? ' — BORRADOR' : ''}</option>
            ))}
          </select>
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

      {/* Barra de acciones de escritorio */}
      <div className="hidden lg:flex items-center justify-center gap-1.5 w-full overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80">
        {accionesDe(acciones, 'barra').map((accion) => (
          <BotonAccion key={accion.id} accion={accion} variante="barra" />
        ))}
      </div>
    </header>
  );
}
