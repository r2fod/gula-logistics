import React, { useState } from 'react';
import { MapPin, Settings, Truck } from 'lucide-react';
import FleetManagerModal from '../FleetManagerModal';
import Tarjeta from '../ui/Tarjeta';
import EstadoVacio from '../ui/EstadoVacio';
import { esTareaActiva } from '../../data/taskPlanning';

// Un evento de la flota: dónde es, con qué camión y en qué consiste.
function TarjetaEvento({ lugar, camion, detalle }) {
  return (
    <Tarjeta className="p-4 sm:p-5 space-y-2 h-full flex flex-col justify-between min-w-0">
      <div className="min-w-0">
        {lugar && <span className="font-extrabold text-amber-300 block text-base font-outfit break-words"><MapPin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{lugar}</span>}
        <span className="text-slate-200 block font-semibold break-words">{camion}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed flex-1 mt-1 break-words">{detalle}</p>
    </Tarjeta>
  );
}

export default function LogisticsTab({ activeWeekData, adminUnlocked, onUpdateWeek }) {
  const [isFleetManagerOpen, setIsFleetManagerOpen] = useState(false);

  const bodasActivas = (activeWeekData?.saturdaySpecial?.weddings || []).filter(esTareaActiva);
  const eventosJueves = (activeWeekData?.schedule?.jueves?.tasks || [])
    .filter((t) => esTareaActiva(t) && /^j\d+$/.test(t.id || ''));

  return (
    <Tarjeta variante="panel" className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h4 className="font-bold text-white text-lg flex items-center space-x-2 font-outfit">
          <Truck className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
          <span>Estado de la Flota & Eventos Clave ({activeWeekData?.meta?.week || "Semana 3"})</span>
        </h4>
        {adminUnlocked && (
          <button 
            type="button"
            onClick={() => setIsFleetManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            Gestionar Flota
          </button>
        )}
      </div>

      <FleetManagerModal 
        isOpen={isFleetManagerOpen} 
        onClose={() => setIsFleetManagerOpen(false)} 
        activeWeekData={activeWeekData}
        onUpdateWeek={onUpdateWeek}
      />

      {bodasActivas.length === 0 && eventosJueves.length === 0 ? (
        <EstadoVacio
          icono={Truck}
          titulo="No hay eventos clave programados para esta semana."
          detalle="Las bodas del sábado y eventos principales del jueves aparecerán aquí."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-3 sm:gap-6 text-sm">
          {bodasActivas.map((w, idx) => (
            <TarjetaEvento key={`boda-${w.id || idx}`} lugar={w.location} camion={w.truck} detalle={w.details} />
          ))}
          {/* "Eventos Clave" son las tareas del jueves con un id manual tipo
              j1/j2/j3... (convención de CLAUDE.md: id corta manual por día). */}
          {eventosJueves.map((t) => (
            <TarjetaEvento key={`jueves-${t.id}`} lugar={t.location} camion={t.truck || 'Sin camión asignado'} detalle={t.text} />
          ))}
        </div>
      )}
    </Tarjeta>
  );
}
