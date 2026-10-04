import React from 'react';
import { UserPlus } from 'lucide-react';
import Chip from '../ui/Chip';
import { asignarEnPropuesta, coincideConTarea, tareasNuevas } from '../../data/comprobarTareas';
import { personasPorTipo, tipoDeTarea } from '../../data/aprendizajeFichajes';
import { NOMBRE_DIA } from '../../data/disponibilidad';
import { coincideNombre } from '../../data/nombresTrabajadores';

const MAX_TAREAS = 6;

// «¿Quién va?» para cada tarea NUEVA de la propuesta, antes de aplicarla: el admin elige
// (o deja lo que puso Gemini). Primero, quien la suele hacer: las mismas tareas en otras
// semanas (`sugerencias`, de resolverPeticion) o, si no, las horas de ese tipo según los
// fichajes (`aprendizaje`). Cambiar a alguien solo toca esa tarea (asignarEnPropuesta).
export default function AsignarNuevas({ original, propuesta, equipo = [], sugerencias = [], aprendizaje = null, onCambiar }) {
  const nuevas = tareasNuevas(original, propuesta);
  if (!nuevas.length) return null;
  const porTipo = personasPorTipo(aprendizaje?.porPersona);

  const sugeridos = (tarea) => {
    const s = sugerencias.find(x => coincideConTarea(tarea.texto, x.item))?.suelen;
    if (s?.lista.length) return s.lista.map(p => ({ nombre: p.nombre, nota: s.fuente === 'planning' ? `${p.veces} ${p.veces === 1 ? 'vez' : 'veces'}` : `${p.horas} h` }));
    return (porTipo[tipoDeTarea(tarea.texto)] || []).slice(0, 3).map(p => ({ nombre: p.nombre, nota: `${p.horas} h` }));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
        <UserPlus className="h-4 w-4" aria-hidden="true" /> ¿Quién va? Elige antes de aplicar
      </p>
      {nuevas.slice(0, MAX_TAREAS).map(tarea => {
        const lista = sugeridos(tarea);
        const nota = (nombre) => lista.find(p => coincideNombre(p.nombre, nombre))?.nota;
        // Primero quien la suele hacer; luego el resto del equipo.
        const orden = [...equipo].sort((a, b) => (nota(b.name) ? 1 : 0) - (nota(a.name) ? 1 : 0));
        const elegido = (nombre) => tarea.personas.some(p => coincideNombre(p, nombre));
        const alternar = (nombre) => onCambiar(asignarEnPropuesta(propuesta, tarea.clave, elegido(nombre) ? tarea.personas.filter(p => !coincideNombre(p, nombre)) : [...tarea.personas, nombre]));
        return (
          <div key={tarea.clave} className="space-y-1.5">
            <p className="text-xs text-slate-200"><b>{NOMBRE_DIA[tarea.dia]}</b>: {tarea.texto}</p>
            <p className="text-[11px] text-slate-400">
              {lista.length ? `Suele hacerla: ${lista.slice(0, 3).map(p => `${p.nombre} (${p.nota})`).join(', ')}.` : 'Nadie la ha hecho aún: elige tú.'}
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Quién va a ${tarea.texto}`}>
              {orden.map(w => (
                <Chip key={w.name} seleccionado={elegido(w.name)} variante="amber" onClick={() => alternar(w.name)} className="!py-1">
                  {w.name}{nota(w.name) && <span className="font-normal opacity-70">· {nota(w.name)}</span>}
                </Chip>
              ))}
            </div>
            {!tarea.personas.length && <p className="text-[11px] text-amber-300">Sin nadie asignado todavía.</p>}
          </div>
        );
      })}
      {nuevas.length > MAX_TAREAS && <p className="text-[11px] text-slate-500">…y {nuevas.length - MAX_TAREAS} tareas nuevas más (cámbialas después en el Cuadrante).</p>}
      <p className="text-[11px] text-slate-500">Si cambias a alguien, lo propondré como regla en Memoria IA para la próxima vez (solo cuenta si la apruebas).</p>
    </div>
  );
}
