import React, { useMemo, useState } from 'react';
import { BrainCircuit, GraduationCap, ListChecks, Network } from 'lucide-react';
import { useMemoriaIa } from '../hooks/useMemoriaIa';
import { construirGrafoMemoria } from '../data/grafoMemoria';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import Chip from './ui/Chip';
import GrafoMemoria from './memoria/GrafoMemoria';
import ReglasPanel from './memoria/ReglasPanel';
import AprendizajePanel from './memoria/AprendizajePanel';

// Memoria del asistente (solo admin): el grafo de lo que sabe, las reglas que
// usa (y las que propone, para aprobarlas) y lo que aprende de los fichajes.
// `aprendizaje` viene de App (aprenderDeFichajes), el mismo que recibe Gemini.
export default function AdminAiMemoryModal({ isOpen, onClose, workersList = [], allWeeks = {}, aprendizaje = null }) {
  const memoria = useMemoriaIa(isOpen);
  const [vista, setVista] = useState('grafo');
  const grafo = useMemo(
    () => construirGrafoMemoria({ equipo: workersList, semanas: allWeeks, aprendizaje, memorias: memoria.memorias }),
    [workersList, allWeeks, aprendizaje, memoria.memorias]
  );

  if (!isOpen) return null;

  const vistas = [
    { id: 'grafo', nombre: 'Grafo', icono: Network },
    { id: 'reglas', nombre: `Reglas (${memoria.activas.length})`, icono: ListChecks, aviso: memoria.propuestas.length },
    { id: 'aprendizaje', nombre: 'Aprendizaje', icono: GraduationCap },
  ];

  return (
    <Modal onCerrar={onClose} ancho="4xl">
      <CabeceraModal
        icono={BrainCircuit}
        degradado="amber-indigo"
        titulo="Memoria del asistente"
        subtitulo="Lo que Gemini sabe del equipo, las reglas que tú apruebas y lo que aprende de los fichajes"
      />

      <div role="group" aria-label="Sección" className="mb-4 flex flex-wrap gap-2">
        {vistas.map(({ id, nombre, icono: Icono, aviso }) => (
          <Chip key={id} variante="indigo" seleccionado={vista === id} onClick={() => setVista(id)}>
            <Icono className="h-3.5 w-3.5" aria-hidden="true" />
            {nombre}
            {aviso > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-slate-950" aria-label={`${aviso} por aprobar`}>{aviso}</span>}
          </Chip>
        ))}
      </div>

      <div key={vista} className="animate-fadeIn motion-reduce:animate-none">
        {vista === 'grafo' && <GrafoMemoria grafo={grafo} />}
        {vista === 'reglas' && <ReglasPanel memoria={memoria} />}
        {vista === 'aprendizaje' && <AprendizajePanel aprendizaje={aprendizaje} />}
      </div>
    </Modal>
  );
}
