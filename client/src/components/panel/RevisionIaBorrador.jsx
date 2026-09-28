import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Boton from '../ui/Boton';
import PropuestaAplicable from '../asistente/PropuestaAplicable';
import { revisarBorradorConGemini } from '../../data/editorIa';
import { GEMINI_API_KEY_STORAGE_KEY } from '../../data/geminiScheduleService';
import { avisosDePropuesta } from '../../data/diffSemana';
import { useMemoriaIa } from '../../hooks/useMemoriaIa';
import { formatearNumero } from '../../data/formatoFinanciero';
import { formatTimeShort, formatWeekdayShortDay } from '../../utils/dateUtils';

const claveDelNavegador = () => { try { return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || ''; } catch { return ''; } };

// Lo que hizo Gemini con este borrador (meta.revisionIa) y el botón para pedirle otra
// revisión, con vista previa. La primera la hace sola la app al crear el borrador
// (App.jsx): el calendario lo crea, Gemini lo mejora y el admin da el toque final.
export default function RevisionIaBorrador({ semana, equipo = [], aprendizaje = null, onGuardar }) {
  const memoria = useMemoriaIa(true);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const revision = semana?.meta?.revisionIa;

  const revisar = async () => {
    setCargando(true);
    setResultado(null);
    const r = await revisarBorradorConGemini({ semana, apiKey: claveDelNavegador(), equipo, memorias: memoria.activas, aprendizaje });
    setResultado({ ...r, via: 'cambios' });
    setCargando(false);
  };

  const aplicar = () => {
    const revisionIa = { el: new Date().toISOString(), cambios: resultado.aplicados, tokens: resultado.uso?.total || 0 };
    onGuardar({ ...resultado.generatedJson, meta: { ...semana.meta, revisionIa } });
    setResultado(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[11px] text-slate-400">
          {revision
            ? `Gemini lo revisó el ${formatWeekdayShortDay(revision.el)} a las ${formatTimeShort(revision.el)}: ${revision.cambios ? `${revision.cambios} ${revision.cambios === 1 ? 'cambio' : 'cambios'}` : 'lo vio bien'} · ${formatearNumero(revision.tokens || 0, 0)} tokens.`
            : 'Gemini aún no lo ha revisado.'}
        </p>
        <Boton variante="indigo" className="px-3 py-1.5 text-xs" onClick={revisar} disabled={cargando}>
          {cargando ? <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          <span className="whitespace-nowrap">{cargando ? 'Revisando…' : 'Revisar con Gemini'}</span>
        </Boton>
      </div>
      {resultado?.errorMsg && <p role="alert" className="text-xs text-rose-300">{resultado.errorMsg}</p>}
      {resultado && !resultado.errorMsg && !resultado.generatedJson && (
        <p role="status" className="text-xs text-emerald-300">Gemini lo ve bien: no propone cambios ({formatearNumero(resultado.uso?.total || 0, 0)} tokens).</p>
      )}
      {resultado?.generatedJson && (
        <PropuestaAplicable
          titulo="Mejoras de Gemini: revísalas antes de aplicarlas"
          actual={semana}
          propuesta={resultado.generatedJson}
          avisos={avisosDePropuesta({ actual: semana, propuesta: resultado.generatedJson, equipo, extra: resultado.avisos })}
          resultado={resultado}
          onAplicar={aplicar}
          onDescartar={() => setResultado(null)}
        />
      )}
    </div>
  );
}
