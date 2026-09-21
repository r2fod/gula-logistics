import React from 'react';
import { parseEventAndTask } from '../data/eventNaming';

// Texto de una tarea con su evento como etiqueta, como la columna "Evento" de
// la hoja de planing. Solo cambia cómo se ve: el texto guardado sigue siendo
// "Evento - Tarea". Sin evento explícito se muestra tal cual.
export default function TaskTextWithEvent({ text }) {
  const { eventName, specificTaskName, explicit } = parseEventAndTask(text);
  if (!explicit) return <>{text}</>;
  return (
    <>
      <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold align-middle bg-amber-500/10 text-amber-300 border border-amber-500/20 not-italic no-underline">
        {eventName}
      </span>
      {specificTaskName}
    </>
  );
}
