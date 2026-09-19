import React from 'react';
import { Truck } from 'lucide-react';

export default function LogisticsTab({ activeWeekData }) {
  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
      <h4 className="font-bold text-white text-lg flex items-center space-x-2 font-['Outfit']">
        <Truck className="w-6 h-6 text-amber-400" />
        <span>Estado de la Flota & Eventos Clave ({activeWeekData?.meta?.week || "Semana 3"})</span>
      </h4>

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
