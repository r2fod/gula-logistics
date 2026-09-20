import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, Check, AlertCircle, RefreshCw, Key, Wand2 } from 'lucide-react';
import { generateScheduleWithGemini, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export default function GeminiAssistantModal({ isOpen, onClose, onApplyGeneratedSchedule, activeWeekData }) {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey.trim());
    setShowApiKeyInput(false);
  };

  const samplePrompts = [
    "Genera la planificación de la Semana 4 para 3 bodas simultáneas el sábado con los 3 camiones (Gula, Covey, Albacar) y reparto de Gonzalo, Ricardo y Johan.",
    "Crea las tareas del martes y miércoles para pre-carga en almacén y recogida del Camión Albacar con 90 sillas extra.",
    "Genera la logística inversa de domingo y lunes para descarga de los 3 camiones y devolución de material a Dealde."
  ];

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setGeneratedJson(null);

    const { generatedJson: result, errorMsg: err } = await generateScheduleWithGemini({ prompt, apiKey, activeWeekData });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <Wand2 className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold font-['Outfit']">Asistente Gemini AI</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-indigo-500 text-slate-950">
                  POWERED BY GEMINI
                </span>
              </div>
              <p className="text-xs text-slate-400">Genera planificaciones de eventos y rutas automáticamente</p>
            </div>
          </div>

          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Configurar Gemini API Key"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>

        {/* API Key Input Form */}
        {showApiKeyInput && (
          <form onSubmit={handleSaveApiKey} className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Google Gemini API Key (Opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              ¿Qué quieres planificar con Gemini AI?
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Escribe tu solicitud (ej: Planifica la Semana 4 para 2 bodas en Sot de Chera y asigna los 3 camiones a Gonzalo, Ricardo y Johan)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
            />
          </div>

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
                  ✨ {sp}
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
              <span>✨ Aplicar esta Planificación a la App</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
