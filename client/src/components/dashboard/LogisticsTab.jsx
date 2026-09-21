import React, { useState } from 'react';
import { Truck, Settings } from 'lucide-react';
import FleetManagerModal from '../FleetManagerModal';
import Tarjeta from '../ui/Tarjeta';

// Un evento de la flota: dónde es, con qué camión y en qué consiste.
function TarjetaEvento({ lugar, camion, detalle }) {
  return (
    <Tarjeta className="p-5 space-y-2">
      <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {lugar}</span>
      <span className="text-slate-200 block font-semibold">{camion}</span>
      <p className="text-xs text-slate-400 leading-relaxed">{detalle}</p>
    </Tarjeta>
  );
}

export default function LogisticsTab({ activeWeekData, adminUnlocked, onUpdateWeek }) {
  const [isFleetManagerOpen, setIsFleetManagerOpen] = useState(false);

  return (
    <Tarjeta variante="panel" className="p-6 space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h4 className="font-bold text-white text-lg flex items-center space-x-2 font-['Outfit']">
          <Truck className="w-6 h-6 text-amber-400" />
          <span>Estado de la Flota & Eventos Clave ({activeWeekData?.meta?.week || "Semana 3"})</span>
        </h4>
        {adminUnlocked && (
          <button 
            onClick={() => setIsFleetManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors"
          >
            <Settings className="w-4 h-4" />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        {(activeWeekData?.saturdaySpecial?.weddings || []).map((w, idx) => (
          <TarjetaEvento key={`boda-${idx}`} lugar={w.location} camion={w.truck} detalle={w.details} />
        ))}
        {/* "Eventos Clave" son las tareas del jueves con un id manual tipo
            j1/j2/j3... (convención de CLAUDE.md: id corta manual por día).
            Antes la lista de ids a mostrar estaba fijada a mano (['j1','j2'])
            y se desincronizaba cada vez que se añadía una nueva desde el
            editor — encontrado en producción con 'j3' (Recogida Evento
            TOUS) ya añadida pero nunca mostrada aquí. Con el patrón /^j\d+$/
            se recoge cualquier tarea con ese id sin volver a tocar este
            archivo. */}
        {(activeWeekData?.schedule?.jueves?.tasks || [])
          .filter((t) => /^j\d+$/.test(t.id || ''))
          .map((t) => (
            <TarjetaEvento key={`jueves-${t.id}`} lugar={t.location} camion={t.truck || 'Sin camión asignado'} detalle={t.text} />
          ))}
      </div>
    </Tarjeta>
  );
}
