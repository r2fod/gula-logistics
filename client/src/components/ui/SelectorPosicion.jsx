import React from 'react';

export default function SelectorPosicion({ currentIndex, totalItems, onChange }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={currentIndex}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="appearance-none bg-slate-900/50 border border-slate-700/80 hover:border-amber-500/50 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-lg cursor-pointer transition-colors outline-none focus:ring-1 focus:ring-amber-500/50 hover:text-amber-400"
      >
        {Array.from({ length: totalItems }).map((_, idx) => (
          <option key={idx} value={idx} className="bg-slate-900 text-slate-300 font-bold">
            #{idx + 1}
          </option>
        ))}
      </select>
    </div>
  );
}
