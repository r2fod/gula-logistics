import React, { useState, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import BotonCerrar from '../ui/BotonCerrar';
import Boton from '../ui/Boton';
import Chip from '../ui/Chip';

// Elige a quién se avisa de que su planning ha cambiado (aviso push). Si no se
// elige a nadie, se avisa a todos.
//
// Props: abierto, onCerrar, workersList, enviando (hay un envío en curso) y
// onEnviar(nombres) con los trabajadores elegidos (lista vacía = todos).
export default function AvisarCambiosModal({ abierto, onCerrar, workersList = [], enviando = false, onEnviar }) {
  const [elegidos, setElegidos] = useState([]);

  // Cada vez que se abre empieza sin nadie elegido.
  useEffect(() => {
    if (abierto) setElegidos([]);
  }, [abierto]);

  const alternar = (nombre) =>
    setElegidos((previos) => (previos.includes(nombre) ? previos.filter((n) => n !== nombre) : [...previos, nombre]));

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} ancho="sm" disposicion="columna" botonCerrar={false} etiqueta="Avisar cambios">
      <div className="p-4 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50 backdrop-blur-md rounded-t-3xl">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Bell className="w-4 h-4 text-indigo-400" />
          </span>
          ¿A quién quieres avisar?
        </h2>
        <BotonCerrar onClick={onCerrar} />
      </div>

      <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          Selecciona a los trabajadores que recibirán la notificación de cambios en su planning. Si no seleccionas a ninguno, se enviará a <strong>todos</strong>.
        </p>

        <button
          onClick={() => setElegidos([])}
          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
            elegidos.length === 0 
              ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border-indigo-500/50 text-indigo-300 font-bold shadow-lg shadow-indigo-500/10' 
              : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
          }`}
        >
          <span>Avisar a Todos</span>
          {elegidos.length === 0 && (
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <Check className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {workersList.map((w) => (
            <Chip
              key={w.name}
              variante="indigo"
              seleccionado={elegidos.includes(w.name)}
              onClick={() => alternar(w.name)}
            >
              <span>{w.avatar}</span>
              <span className="truncate">{w.name}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="p-5 border-t border-slate-800/60 bg-slate-900/40 backdrop-blur-md flex gap-3 rounded-b-3xl">
        <Boton onClick={onCerrar} variante="secundario" className="flex-1">
          Cancelar
        </Boton>
        <Boton
          onClick={() => onEnviar(elegidos)}
          disabled={enviando}
          variante="indigo"
          className="flex-1"
        >
          <Bell className={`w-4 h-4 ${enviando ? 'animate-pulse' : ''}`} />
          {enviando ? 'Enviando Aviso...' : 'Enviar Aviso Push'}
        </Boton>
      </div>
    </Modal>
  );
}
