import React, { useState } from 'react';
import { Truck, Settings } from 'lucide-react';
import FleetManagerModal from '../FleetManagerModal';

export default function LogisticsTab({ activeWeekData, adminUnlocked, onUpdateWeek }) {
  const [isFleetManagerOpen, setIsFleetManagerOpen] = useState(false);

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
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
          <div key={`boda-${idx}`} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
            <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {w.location}</span>
            <span className="text-slate-200 block font-semibold">{w.truck}</span>
            <p className="text-xs text-slate-400 leading-relaxed">{w.details}</p>
          </div>
        ))}
        {(activeWeekData?.schedule?.jueves?.tasks || [])
          .filter((t) => ['j1', 'j2'].includes(t.id))
          .map((t) => (
            <div key={`jueves-${t.id}`} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {t.location}</span>
              <span className="text-slate-200 block font-semibold">{t.truck || 'Sin camión asignado'}</span>
              <p className="text-xs text-slate-400 leading-relaxed">{t.text}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
