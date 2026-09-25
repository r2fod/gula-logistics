import React, { useState } from 'react';
import { Sparkles, Check, AlertCircle, RefreshCw, Key, Wand2 } from 'lucide-react';
import { generateScheduleWithGemini, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input, AreaTexto } from './ui/Campo';

export default function GeminiAssistantModal({ isOpen, onClose, onApplyGeneratedSchedule, activeWeekData, allWeeks = {}, workersList = [] }) {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey.trim());
    setShowApiKeyInput(false);
  };

  const samplePrompts = [
    "Reorganiza las cargas de mañana: pon a Ricardo y Jeferson en la carga del Gula, y a Gonzalo en la del Covey.",
    "Quita a Irene de las tareas del sábado y ponla a hacer las recogidas de almacén el viernes por la mañana.",
    "Ajusta automáticamente todos los horarios previstos basándote en los retrasos reales de semanas pasadas."
  ];

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setGeneratedJson(null);

    const { generatedJson: result, errorMsg: err } = await generateScheduleWithGemini({ prompt, apiKey, activeWeekData, roster: workersList, allWeeks });
    setGeneratedJson(result);
    if (err) setErrorMsg(err);
    setLoading(false);
  };

  const handleApply = () => {
    if (generatedJson) {
      onApplyGeneratedSchedule(generatedJson);
      onClose();
    }
  };

  return (
    <Modal onCerrar={onClose} ancho="2xl">
      <CabeceraModal
        icono={Wand2}
        degradado="amber-indigo"
        titulo="Asistente Gemini AI"
        subtitulo="Genera planificaciones de eventos y rutas automáticamente"
        insignia={
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-indigo-500 text-slate-950">
            POWERED BY GEMINI
          </span>
        }
        acciones={
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="mr-10 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Configurar Gemini API Key"
          >
            <Key className="w-4 h-4" />
          </button>
        }
        className="mb-6"
      />

      {/* API Key Input Form */}
      {showApiKeyInput && (
        <form onSubmit={handleSaveApiKey} className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Google Gemini API Key (necesaria para generar)
          </label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              tamano="sm"
              fondo="medio"
              className="flex-1"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* Prompt Input Form */}
      <form onSubmit={handleGenerate} className="space-y-4">
        <Campo etiqueta="¿Qué quieres planificar con Gemini AI?">
          <AreaTexto
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe tu solicitud (ej: Planifica la Semana 4 para 2 bodas en Sot de Chera y asigna los 3 camiones a Gonzalo, Ricardo y Johan)..."
            tamano="xl"
            redondeo="2xl"
            acento="amber-suave"
            className="w-full transition-all"
          />
        </Campo>

        {/* Quick Sample Prompts */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-slate-400">Sugerencias rápidas:</span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((sp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sp)}
                className="text-left text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 p-2.5 rounded-xl transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{sp}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-indigo-500 hover:opacity-95 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generando Planificación con Gemini AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generar Planificación Inteligente</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Generated Schedule Preview */}
      {generatedJson && (
        <div className="mt-6 space-y-4 border-t border-slate-800 pt-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-amber-400 flex items-center space-x-1.5">
              <Check className="w-4 h-4" />
              <span>Planificación Generada por Gemini AI</span>
            </h4>
            <span className="text-[11px] text-slate-400">{generatedJson.meta?.week}</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-3 max-h-60 overflow-y-auto">
            <div className="font-bold text-white">{generatedJson.saturdaySpecial?.title}</div>
            <ul className="space-y-1.5 text-slate-300">
              {(generatedJson.saturdaySpecial?.weddings || []).map((w, idx) => (
                <li key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="font-bold text-amber-300">{w.location}</span> ({w.truck}) - {w.details}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleApply}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Aplicar esta Planificación a la App</span>
          </button>
        </div>
      )}
    </Modal>
  );
}
