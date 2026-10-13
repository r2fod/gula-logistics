import React from 'react';
import { Lock } from 'lucide-react';

const TEXTOS = {
  // En la vista de un trabajador que ha entrado sin su enlace personal.
  trabajador: 'Para ver tus fichajes y fichar necesitas tu enlace personal. Pídeselo al administrador y ábrelo en este móvil.',
  // En la vista pública (la actividad en directo de todo el equipo).
  publica: 'La actividad del equipo ya no es pública. Cada persona ve sus fichajes y sus horas con su enlace personal; el administrador, los de todos.',
};

// Cuando el admin exige el enlace personal, el servidor solo da los fichajes a quien
// puede verlos (GET /api/clock, `accesoAFichajes`). Esto se enseña donde antes se
// veían sin más, para que una lista vacía no parezca «nadie ha fichado».
export default function AvisoFichajesPrivados({ vista = 'trabajador', className = '' }) {
  return (
    <div role="status" className={`flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 animate-fadeIn motion-reduce:animate-none ${className}`}>
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <span>{TEXTOS[vista] || TEXTOS.trabajador}</span>
    </div>
  );
}
