import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'lucide-react';
import { colocarGrafo, vecinosDe, TIPOS_NODO } from '../../data/grafoMemoria';
import { formatearMinutos } from '../../data/aprendizajeFichajes';
import { formatearHoras } from '../../data/formatoFinanciero';
import EstadoVacio from '../ui/EstadoVacio';

// Grafo visual de la memoria del asistente (datos: construirGrafoMemoria).
// SVG propio, sin librerías: tipos de tarea en el centro, personas alrededor y
// camiones y reglas por fuera. Tocar un nodo resalta con qué se relaciona y
// enseña el detalle debajo; tocar el fondo lo quita. Se adapta al ancho real
// (en móvil es más alto que ancho y solo rotula lo elegido).
const ESTRECHO = 520;

const radioDe = (n, estrecho) => {
  const base = n.tipo === 'tipo' ? 11 + Math.min(12, Math.sqrt(n.peso) * 2)
    : n.tipo === 'persona' ? 7 + Math.min(7, Math.sqrt(n.peso))
      : n.tipo === 'regla' ? 6 : 7;
  return estrecho ? Math.max(5, base * 0.6) : base;
};

const textoPeso = (v) => (v.etiqueta === 'h fichadas' ? `${formatearHoras(v.peso)} fichadas`
  : v.etiqueta === 'veces juntos' ? `${v.peso} ${v.peso === 1 ? 'vez' : 'veces'} en el planning` : v.etiqueta);

export default function GrafoMemoria({ grafo }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(720);
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.max(260, Math.round(entrada.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const estrecho = ancho < ESTRECHO;
  const alto = estrecho ? Math.round(ancho * 1.3) : Math.round(ancho * 0.62);
  const colocados = useMemo(() => colocarGrafo(grafo, { ancho, alto }), [grafo, ancho, alto]);
  const porId = useMemo(() => new Map(colocados.map(n => [n.id, n])), [colocados]);
  const vecinos = useMemo(() => (elegido ? vecinosDe(grafo, elegido) : []), [grafo, elegido]);
  const cercanos = useMemo(() => new Set([elegido, ...vecinos.map(v => v.nodo.id)]), [elegido, vecinos]);
  const maxPeso = Math.max(1, ...grafo.enlaces.map(e => e.peso));
  const nodoElegido = elegido ? porId.get(elegido) : null;

  if (!grafo.nodos.length) {
    return <EstadoVacio icono={Network} titulo="Aún no hay nada que dibujar" detalle="Aparece en cuanto haya fichajes, planning o reglas guardadas." />;
  }

  const cuenta = (tipo) => grafo.nodos.filter(n => n.tipo === tipo).length;
  const alternar = (id) => setElegido(prev => (prev === id ? null : id));

  return (
    <div className="space-y-3">
      <div ref={contenedor} className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          width="100%"
          height={alto}
          role="group"
          aria-label={`Memoria del asistente: ${cuenta('tipo')} tipos de tarea, ${cuenta('persona')} personas, ${cuenta('camion')} camiones y ${cuenta('regla')} reglas`}
          onClick={() => setElegido(null)}
          className="block select-none"
        >
          <g>
            {grafo.enlaces.map(e => {
              const a = porId.get(e.origen);
              const b = porId.get(e.destino);
              if (!a || !b) return null;
              const activo = elegido && (e.origen === elegido || e.destino === elegido);
              return (
                <line
                  key={`${e.origen}|${e.destino}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  className={`transition-[stroke-opacity] duration-300 ${activo ? 'stroke-amber-300' : 'stroke-slate-500'}`}
                  strokeWidth={1 + (3 * e.peso) / maxPeso}
                  strokeOpacity={elegido ? (activo ? 0.9 : 0.06) : 0.18 + (0.45 * e.peso) / maxPeso}
                />
              );
            })}
          </g>
          <g>
            {colocados.map((n, i) => {
              const r = radioDe(n, estrecho);
              const atenuado = elegido && !cercanos.has(n.id);
              const rotulado = n.tipo === 'tipo' || n.tipo === 'regla' || !estrecho || (elegido && cercanos.has(n.id));
              const cos = Math.cos(n.angulo);
              let ancla = n.tipo === 'tipo' ? 'middle' : cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
              let lx = n.tipo === 'tipo' ? n.x : n.x + cos * (r + 6);
              // Que la etiqueta no se salga del lienzo: si no cabe por un lado, al otro.
              const largo = n.etiqueta.length * 6.5;
              if (ancla === 'start' && lx + largo > ancho - 4) { ancla = 'end'; lx = n.x - (r + 6); }
              else if (ancla === 'end' && lx - largo < 4) { ancla = 'start'; lx = n.x + r + 6; }
              else if (ancla === 'middle') lx = Math.min(Math.max(lx, largo / 2 + 4), ancho - largo / 2 - 4);
              const ly = n.tipo === 'tipo' ? n.y + r + 14 : n.y + Math.sin(n.angulo) * (r + 6) + 4;
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={elegido === n.id}
                  aria-label={`${TIPOS_NODO[n.tipo].singular}: ${n.texto || n.etiqueta}`}
                  onClick={(ev) => { ev.stopPropagation(); alternar(n.id); }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(n.id); }
                    if (ev.key === 'Escape') setElegido(null);
                  }}
                  className="group cursor-pointer focus:outline-none"
                  opacity={atenuado ? 0.22 : 1}
                >
                  <g className="animate-aparecer motion-reduce:animate-none" style={{ animationDelay: `${Math.min(i, 40) * 25}ms` }}>
                    {/* Zona táctil más grande que el punto (dedos en el móvil). */}
                    <circle cx={n.x} cy={n.y} r={r + 10} fill="transparent" />
                    <circle cx={n.x} cy={n.y} r={r + 5} className="fill-none stroke-amber-300 opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
                    <circle
                      cx={n.x} cy={n.y} r={r}
                      className={`${TIPOS_NODO[n.tipo].clase} stroke-slate-950 group-hover:brightness-125`}
                      strokeWidth={2}
                      strokeDasharray={n.propuesta ? '3 2' : undefined}
                      fillOpacity={n.propuesta ? 0.45 : 1}
                    />
                    {rotulado && (
                      <text x={lx} y={ly} textAnchor={ancla} className={`${n.tipo === 'tipo' ? 'fill-amber-200 font-bold' : 'fill-slate-300'} text-[11px] sm:text-xs`}>
                        {n.etiqueta}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-400" aria-label="Leyenda">
        {Object.entries(TIPOS_NODO).map(([tipo, { nombre, clase }]) => (
          <li key={tipo} className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" className={clase} /></svg>
            {nombre} ({cuenta(tipo)})
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className="fill-emerald-400/40 stroke-emerald-400" strokeDasharray="2 1.5" /></svg>
          Regla propuesta, sin aprobar
        </li>
      </ul>

      <div aria-live="polite" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm min-h-[3.25rem]">
        {!nodoElegido ? (
          <p className="text-xs text-slate-500">Toca un punto para ver con qué se relaciona. Las líneas más gruesas pesan más (horas fichadas o veces juntos en el planning).</p>
        ) : (
          <div className="space-y-2 animate-fadeIn">
            <p className="font-bold text-white">
              {nodoElegido.tipo === 'regla' ? `Regla ${nodoElegido.etiqueta}` : nodoElegido.etiqueta}
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{TIPOS_NODO[nodoElegido.tipo].singular}</span>
            </p>
            {nodoElegido.texto && <p className="text-xs text-slate-300">«{nodoElegido.texto}»{nodoElegido.propuesta ? ' — propuesta, aún no la usa Gemini' : ''}</p>}
            {nodoElegido.detalle && (
              <p className="text-xs text-slate-300">
                Planificado {formatearMinutos(nodoElegido.detalle.planificadoMin)} de media, fichado {formatearMinutos(nodoElegido.detalle.realMin)} ({nodoElegido.detalle.tareas} tareas medidas).
              </p>
            )}
            {vecinos.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {vecinos.map(v => (
                  <li key={v.nodo.id}>
                    <button type="button" onClick={() => setElegido(v.nodo.id)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 hover:border-amber-500/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70">
                      {v.nodo.tipo === 'regla' ? `Regla ${v.nodo.etiqueta}` : v.nodo.etiqueta} · {textoPeso(v)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-500">Todavía sin relaciones.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
