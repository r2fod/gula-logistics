import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

// De dónde saldrá la clave de Gemini: la de este navegador va primero y, si no hay,
// la del servidor. `enServidor` null (no se sabe: sin sesión o sin red) no dice nada.
export default function EstadoClaveIa({ enNavegador = false, enServidor = null, className = '' }) {
  const base = `flex items-start gap-1.5 text-[11px] leading-snug ${className}`;
  if (enNavegador) {
    return <p className={`${base} text-slate-400`}><Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />Usa la clave guardada en este navegador.</p>;
  }
  if (enServidor === true) {
    return <p className={`${base} text-emerald-400`}><Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />Usa la clave del servidor: no hace falta pegar ninguna.</p>;
  }
  if (enServidor === false) {
    return (
      <p role="status" className={`${base} text-amber-300`}>
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />Falta la clave de Gemini: ponla en Render (GEMINI_API_KEY) o pégala en este navegador.
      </p>
    );
  }
  return null;
}
