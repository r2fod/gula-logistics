import React from 'react';

// Aviso de por qué no se puede fichar una tarea todavía (día que no ha llegado, puerta de los 5 min).
export default function AvisoBloqueado({ children, className = '' }) {
  return (
    <span className={`inline-block px-2 py-1 rounded bg-slate-800/80 text-[11px] text-slate-400 font-medium ${className}`}>
      🔒 {children}
    </span>
  );
}
