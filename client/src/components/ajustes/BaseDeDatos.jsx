import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { revisarBaseDeDatos } from '../../data/saludBaseDatos';
import { useAhora } from '../../hooks/useAhora';
import { useDialog } from '../../contexts/DialogContext';
import { confirmarMoverAPapelera, confirmarVaciarPapelera } from '../dashboard/fichajes/confirmaciones';

// Una línea del estado: verde si está bien, ámbar si hay algo; a la derecha, su acción.
function Fila({ bien, titulo, detalle = null, accion = null, onAccion, peligro = false }) {
  const Icono = bien ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <span className="flex min-w-0 flex-1 basis-48 items-start gap-2">
        <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${bien ? 'text-emerald-400' : 'text-amber-400'}`} aria-hidden="true" />
        <span className="min-w-0 text-xs">
          <span className="block font-semibold text-slate-200">{titulo}</span>
          {detalle && <span className="block text-[11px] text-slate-400">{detalle}</span>}
        </span>
      </span>
      {accion && (
        <button
          type="button"
          onClick={onAccion}
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${peligro ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}
        >
          {accion}
        </button>
      )}
    </li>
  );
}

// «Configuración → Base de datos»: optimización, limpieza y datos huérfanos de un vistazo,
// con su acción al lado (las mismas confirmaciones que en Fichajes). Solo lee lo que la
// app ya tiene cargado: abrirla no consulta ni cambia nada.
export default function BaseDeDatos({ fichajes = [], borrados = [], equipo = [], semanas = {}, fichas = [], onVaciarPapelera = null, onMoverAPapelera = null, onIrAFichajes = null }) {
  const { confirm } = useDialog();
  const ahora = useAhora(60000);
  const [verHuerfanos, setVerHuerfanos] = useState(false);
  const r = useMemo(() => revisarBaseDeDatos({ fichajes, borrados, equipo, semanas, fichas, ahora }), [fichajes, borrados, equipo, semanas, fichas, ahora]);
  const huerfanos = r.fichajesSinPersona.length + r.tareasSinPersona.length + r.fichasSinPersona.length + r.personasSinFicha.length;

  return (
    <section aria-labelledby="titulo-base-datos" className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="titulo-base-datos" className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
          <Database className="h-3.5 w-3.5" aria-hidden="true" /> Base de datos
        </h4>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.pendientes ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {r.pendientes ? `${r.pendientes} ${r.pendientes === 1 ? 'cosa' : 'cosas'} para mirar` : 'Todo en orden'}
        </span>
      </div>
      <ul className="mt-1 divide-y divide-slate-800/70">
        <Fila bien titulo="Optimizada" detalle="MongoDB Atlas mantiene sola los índices y el espacio: no hace falta hacer nada." />
        <Fila
          bien={!r.papelera}
          titulo={r.papelera ? `${r.papelera} ${r.papelera === 1 ? 'fichaje' : 'fichajes'} en la papelera` : 'Papelera vacía'}
          detalle={r.papelera ? 'No cuentan en horas ni saldos; vaciarla los borra para siempre.' : null}
          accion={r.papelera && onVaciarPapelera ? 'Vaciar' : null}
          peligro
          onAccion={async () => { if (await confirmarVaciarPapelera(confirm, r.papelera)) onVaciarPapelera(); }}
        />
        <Fila
          bien={!r.idsQueSobran.length}
          titulo={r.idsQueSobran.length ? `${r.idsQueSobran.length} fichajes que sobran` : 'Ningún fichaje sobra'}
          detalle={r.idsQueSobran.length ? 'Turnos de 0 minutos, entradas dobles…: no cuentan; quitarlos no cambia nada.' : null}
          accion={r.idsQueSobran.length && onMoverAPapelera ? 'A la papelera' : null}
          onAccion={async () => { if (await confirmarMoverAPapelera(confirm, r.idsQueSobran.length)) onMoverAPapelera(r.idsQueSobran); }}
        />
        <Fila
          bien={!r.turnosLargos}
          titulo={r.turnosLargos ? `${r.turnosLargos} ${r.turnosLargos === 1 ? 'turno muy largo' : 'turnos muy largos'} por revisar` : 'Sin turnos raros'}
          detalle={r.turnosLargos ? 'Se pagan enteros: mira si alguien se olvidó de fichar la salida.' : null}
          accion={r.turnosLargos && onIrAFichajes ? 'Revisar' : null}
          onAccion={onIrAFichajes}
        />
        <Fila
          bien={!huerfanos}
          titulo={huerfanos ? 'Datos de gente que no está en el equipo' : 'Sin datos huérfanos'}
          detalle={huerfanos ? null : 'Fichajes, tareas y fichas de Saldos apuntan a gente del equipo.'}
          accion={huerfanos ? (verHuerfanos ? 'Ocultar' : 'Ver') : null}
          onAccion={() => setVerHuerfanos(v => !v)}
        />
      </ul>
      {huerfanos > 0 && verHuerfanos && (
        <div className="mt-1 space-y-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 text-[11px] text-slate-300 animate-aparecer motion-reduce:animate-none">
          {r.fichajesSinPersona.length > 0 && <p><b>Fichajes de:</b> {r.fichajesSinPersona.join(', ')} — se conservan: son su historial de horas y pagos.</p>}
          {r.tareasSinPersona.length > 0 && (
            <div>
              <p className="font-bold">Tareas asignadas a quien no está (corrígelo en el Cuadrante):</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                {r.tareasSinPersona.slice(0, 8).map((t, i) => <li key={i}>{t.semana} · {t.dia}: {t.tarea} → {t.nombre}</li>)}
                {r.tareasSinPersona.length > 8 && <li>…y {r.tareasSinPersona.length - 8} más</li>}
              </ul>
            </div>
          )}
          {r.fichasSinPersona.length > 0 && <p><b>Fichas de Saldos sin persona en el equipo:</b> {r.fichasSinPersona.join(', ')}.</p>}
          {r.personasSinFicha.length > 0 && <p><b>Del equipo sin ficha de Saldos:</b> {r.personasSinFicha.join(', ')}.</p>}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Se revisa sola cada vez que abres Configuración.</p>
    </section>
  );
}
