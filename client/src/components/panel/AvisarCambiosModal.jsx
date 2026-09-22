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
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          ¿A quién quieres avisar?
        </h2>
        <BotonCerrar onClick={onCerrar} />
      </div>

      <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
        <p className="text-xs text-slate-400 mb-3">
          Selecciona a los trabajadores que recibirán la notificación de cambios en su planning. Si no seleccionas a ninguno, se enviará a <strong>todos</strong>.
        </p>

        <button
          onClick={() => setElegidos([])}
          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${elegidos.length === 0 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'}`}
        >
          <span>Avisar a Todos</span>
          {elegidos.length === 0 && <Check className="w-4 h-4" />}
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

      <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2 rounded-b-2xl">
        <Boton onClick={onCerrar} variante="secundario">
          Cancelar
        </Boton>
        <Boton
          onClick={() => onEnviar(elegidos)}
          disabled={enviando}
          variante="indigo"
        >
          <Bell className={`w-3.5 h-3.5 ${enviando ? 'animate-pulse' : ''}`} />
          {enviando ? 'Enviando...' : 'Enviar Aviso'}
        </Boton>
      </div>
    </Modal>
  );
}
