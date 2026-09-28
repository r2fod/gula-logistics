import React from 'react';
import Boton from '../ui/Boton';
import CambiosPropuestos from './CambiosPropuestos';
import GastoGemini from './GastoGemini';
import { diffSemana } from '../../data/diffSemana';

// Una propuesta de cambios sobre la semana, para revisarla y aplicarla de un clic
// (reajuste por disponibilidad, revisión de Gemini…). `resultado`: lo que gastó, si
// vino de Gemini (GastoGemini).
export default function PropuestaAplicable({ titulo, actual, propuesta, avisos = [], resultado = null, onAplicar, onDescartar }) {
  return (
    <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3">
      <p className="text-xs font-bold text-indigo-200">{titulo}</p>
      <GastoGemini resultado={resultado} />
      <CambiosPropuestos diff={diffSemana(actual, propuesta)} avisos={avisos} />
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" className="text-xs" onClick={onAplicar}>Aplicar</Boton>
        <Boton variante="secundario" className="text-xs" onClick={onDescartar}>Descartar</Boton>
      </div>
    </div>
  );
}
