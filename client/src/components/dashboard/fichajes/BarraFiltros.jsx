import React from 'react';
import { Search, X, ChevronsUpDown } from 'lucide-react';

const TIPOS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'entrada', texto: 'Entradas' },
  { id: 'salida', texto: 'Salidas' },
  { id: 'fichaje', texto: 'Tareas' },
];

// Filtros del historial: búsqueda de texto, tipo (con cuántos hay de cada uno),
// persona, y plegar o desplegar todos los días. `cuentas` = { todos, entrada, salida, fichaje }.
export default function BarraFiltros({ consulta, onConsulta, tipo, onTipo, persona, onPersona, personas, cuentas, hayFiltros, onLimpiar, todosAbiertos, onAlternarTodos }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 shadow-lg sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en los fichajes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            id="buscar-fichajes"
            type="search"
            value={consulta}
            onChange={(e) => onConsulta(e.target.value)}
            placeholder="Buscar por persona, tarea o nota…"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-9 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
          />
          {consulta && (
            <button type="button" onClick={() => onConsulta('')} aria-label="Borrar la búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:text-white">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por persona</span>
          <select
            id="filtrar-persona"
            value={persona}
            onChange={(e) => onPersona(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-200 focus:border-amber-500/60 focus:outline-none"
          >
            <option value="todas">Todas las personas</option>
            {personas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Tipo de fichaje" className="flex flex-wrap gap-1.5">
          {TIPOS.filter(t => t.id === 'todos' || cuentas[t.id] > 0).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTipo(t.id)}
              aria-pressed={tipo === t.id}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${
                tipo === t.id ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {t.texto} <span className={`tabular-nums ${tipo === t.id ? 'text-slate-900/70' : 'text-slate-500'}`}>{cuentas[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {hayFiltros && (
            <button type="button" onClick={onLimpiar} className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-400 transition-colors hover:bg-amber-500/10">
              Quitar filtros
            </button>
          )}
          <button
            type="button"
            onClick={onAlternarTodos}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-white"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            {todosAbiertos ? 'Plegar todo' : 'Desplegar todo'}
          </button>
        </div>
      </div>
    </div>
  );
}
