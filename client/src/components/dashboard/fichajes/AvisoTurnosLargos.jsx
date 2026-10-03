import React, { useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import { revisarFichajes } from '../../../data/revisionFichajes';
import { useAhora } from '../../../hooks/useAhora';

// Aviso al admin, en cualquier pestaña, de los turnos de más de 14 h (o abiertos hace
// más de 12 h) que nadie ha revisado. «Revisar» lleva a Fichajes, donde se corrigen o se
// dan por buenos. Lleva su propio reloj para no repintar el panel entero.
export default function AvisoTurnosLargos({ fichajes, onRevisar }) {
  const ahora = useAhora(60000);
  const { revisar } = useMemo(() => revisarFichajes(fichajes, ahora), [fichajes, ahora]);
  if (!revisar.length) return null;

  const [primero] = revisar;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[11px] text-amber-100 sm:text-xs">
      <span className="flex min-w-0 flex-1 basis-64 items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
        <span>
          <b>{revisar.length === 1 ? 'Un turno muy largo' : `${revisar.length} turnos muy largos`} para revisar.</b>{' '}
          {primero.persona}: {primero.detalle}
        </span>
      </span>
      <button type="button" onClick={onRevisar} className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 font-bold text-amber-200 hover:bg-amber-500/30">
        Revisar
      </button>
    </div>
  );
}
