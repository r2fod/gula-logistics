import React from 'react';
import { LogIn, LogOut, CircleCheck } from 'lucide-react';

const TIPOS = {
  entrada: { Icono: LogIn, texto: 'Entrada', clase: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  salida: { Icono: LogOut, texto: 'Salida', clase: 'border-rose-500/30 bg-rose-500/10 text-rose-400' },
  fichaje: { Icono: CircleCheck, texto: 'Tarea', clase: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
};

// Etiqueta del tipo de fichaje con su icono. Una entrada cuyo turno sigue abierto
// (`enCurso`) lleva un punto verde que late.
export default function InsigniaTipo({ tipo, enCurso = false }) {
  const { Icono, texto, clase } = TIPOS[tipo] || TIPOS.fichaje;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${clase}`}>
      {enCurso ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      ) : (
        <Icono className="h-3 w-3" aria-hidden="true" />
      )}
      {texto}
      {enCurso && <span className="sr-only"> (turno en curso)</span>}
    </span>
  );
}
