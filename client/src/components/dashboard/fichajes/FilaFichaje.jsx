import React from 'react';
import { Pencil, Trash2, Timer } from 'lucide-react';
import InsigniaTipo from './InsigniaTipo';
import { formatTimeShort, formatWeekdayShortDay } from '../../../utils/dateUtils';
import { horaDeFichaje } from '../../../data/fichajes';
import { formatearEuros, formatearHoras } from '../../../data/formatoFinanciero';

// Plantillas de columnas de escritorio (clases completas para que Tailwind las
// detecte). Con o sin la columna de acciones del administrador. La cabecera de la
// lista usa las mismas, así que todo queda alineado.
export const PLANTILLA_FILA = {
  admin: 'md:grid-cols-[5.5rem_7rem_11rem_minmax(0,1fr)_4.5rem_8.5rem]',
  lectura: 'md:grid-cols-[5.5rem_7rem_11rem_minmax(0,1fr)_4.5rem]',
};

// Un fichaje. En móvil se apila (hora + tipo + tarifa arriba, persona, tarea y
// acciones debajo); desde `md` es una fila de columnas. `turno` es el turno que
// cierra esta salida, si lo es; `enCurso`, que esta entrada tiene su turno abierto.
export default function FilaFichaje({ entrada, avatar, turno = null, enCurso = false, admin = false, onEditar, onEliminar, retraso = 0 }) {
  const nombre = entrada.workerName || entrada.worker || entrada.name || 'Desconocido';
  const hora = horaDeFichaje(entrada);
  const tarea = entrada.taskName || entrada.note || '—';
  // Una salida de madrugada cierra un turno que empezó el día anterior: se dice
  // cuándo empezó para que no parezca una salida sin entrada.
  const inicioTurno = turno?.startEntry?.timestamp ? new Date(turno.startEntry.timestamp) : null;
  const empezoOtroDia = Boolean(inicioTurno && entrada.timestamp && inicioTurno.toDateString() !== new Date(entrada.timestamp).toDateString());
  const diaCorto = empezoOtroDia ? formatWeekdayShortDay(inicioTurno) : '';
  const notaAparte = entrada.taskName && entrada.note && entrada.note !== entrada.taskName ? entrada.note : null;

  return (
    <li
      className={`group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-slate-800/60 px-3.5 py-3 sm:px-5 transition-colors last:border-b-0 hover:bg-slate-800/30 animate-aparecer motion-reduce:animate-none ${admin ? PLANTILLA_FILA.admin : PLANTILLA_FILA.lectura}`}
      style={{ animationDelay: `${retraso}ms` }}
    >
      <div className="flex items-center gap-2.5 md:contents">
        <time className="font-mono text-sm font-bold tabular-nums text-white">{hora}</time>
        <InsigniaTipo tipo={entrada.type} enCurso={enCurso} />
      </div>

      <p className="col-start-2 row-start-1 text-right text-xs font-bold tabular-nums text-amber-400 md:col-auto md:row-auto md:order-5">
        {entrada.rate || 10} €/h
      </p>

      <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-auto md:order-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-800 text-sm" aria-hidden="true">{avatar || '👤'}</span>
        <span className="truncate text-sm font-bold text-slate-200">{nombre}</span>
      </div>

      <div className="col-span-2 min-w-0 md:col-auto md:order-4">
        <p className="break-words text-xs font-medium text-slate-300">{tarea}</p>
        {notaAparte && <p className="mt-0.5 break-words text-[11px] italic text-slate-500">{notaAparte}</p>}
        {turno && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-950/60 px-2 py-0.5 text-[11px] tabular-nums text-slate-400">
            <Timer className="h-3 w-3 text-amber-400" aria-hidden="true" />
            Turno {formatearHoras(turno.durationHours)} <span className="text-slate-600">·</span> <span className="font-semibold text-slate-200">{formatearEuros(turno.cost)}</span>
            {empezoOtroDia && <span className="text-slate-500"> · empezó el {diaCorto} a las {formatTimeShort(turno.startEntry.timestamp)}</span>}
          </p>
        )}
      </div>

      {admin && (
        <div className="col-span-2 flex items-center justify-end gap-2 md:col-auto md:order-6">
          <button
            type="button"
            onClick={() => onEditar(entrada)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <button
            type="button"
            onClick={() => onEliminar(entrada)}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 transition-colors hover:bg-rose-500/20"
            title="Eliminar fichaje (admin)"
            aria-label={`Eliminar el fichaje de ${nombre} de las ${hora}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}
