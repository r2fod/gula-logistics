import React from 'react';
import { AreaTexto } from '../ui/Campo';
import CampoEvento from './CampoEvento';
import { parseEventAndTask } from '../../data/eventNaming';

// El evento y la descripción de una tarea del editor del planning, por separado. El
// texto de una tarea es "EVENTO - Tarea" (CONTEXTO.md): aquí se parte para editarlo y
// se vuelve a unir. Lo usan los días de diario y la lista de domingo y lunes (antes
// esa lista solo tenía el texto en bruto y no se podía elegir el evento).
//
// Una tarea anterior a ese formato que ya lleva su evento en el campo `event` (sin él
// en el texto) se edita EN ESE CAMPO y su texto no se toca: los fichajes ya hechos
// guardan el texto tal cual, así que reescribirlo los desligaba de la tarea y de su evento.
//
// Props: tarea (objeto o texto), eventos (los de la semana, para los botones),
// onCambiarTexto(texto), onCambiarEvento(evento) —solo para las de campo `event`—.
export default function EventoYTarea({ tarea, eventos = [], onCambiarTexto, onCambiarEvento }) {
  const texto = (typeof tarea === 'object' ? tarea?.text : tarea) || '';
  let evento = '';
  let descripcion = texto;
  if (texto.includes(' - ')) {
    const partes = texto.split(' - ');
    evento = partes[0];
    descripcion = partes.slice(1).join(' - ');
  }
  const deCampo = typeof tarea === 'object' && tarea !== null && !parseEventAndTask(texto).explicit
    && typeof tarea.event === 'string'; // aunque se vacíe: sigue siendo una tarea "de campo"
  if (deCampo) evento = tarea.event;

  const cambiar = (nuevoEvento, nuevaDescripcion) => {
    if (deCampo) {
      if (nuevaDescripcion !== texto) onCambiarTexto(nuevaDescripcion);
      if (nuevoEvento !== evento) onCambiarEvento(nuevoEvento);
      return;
    }
    onCambiarTexto(nuevoEvento.trim() ? `${nuevoEvento} - ${nuevaDescripcion}` : nuevaDescripcion);
  };

  return (
    <div className="flex flex-col gap-2">
      <CampoEvento valor={evento} eventos={eventos} onCambiar={(nuevo) => cambiar(nuevo, deCampo ? texto : descripcion)} />
      <div>
        <label className="text-[11px] text-slate-400 uppercase font-bold mb-1 block">Descripción de la Tarea Específica</label>
        <AreaTexto
          rows={2}
          value={deCampo ? texto : descripcion}
          onChange={(e) => cambiar(evento, e.target.value)}
          placeholder="Ej: Carga de camión y montaje de carpas..."
          aria-label="Descripción de la tarea"
          tamano="sm" redondeo="lg" texto="suave" className="w-full resize-y min-h-[60px]"
        />
      </div>
    </div>
  );
}
