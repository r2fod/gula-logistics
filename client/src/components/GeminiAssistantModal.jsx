import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, Check, AlertCircle, RefreshCw, Key, Wand2 } from 'lucide-react';

export default function GeminiAssistantModal({ isOpen, onClose, onApplyGeneratedSchedule, activeWeekData }) {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gula_gemini_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem('gula_gemini_api_key', apiKey.trim());
    setShowApiKeyInput(false);
  };

  const samplePrompts = [
    "Genera la planificación de la Semana 4 para 3 bodas simultáneas el sábado con los 3 camiones (Gula, Covey, Albacar) y reparto de Gonzalo, Ricardo, Jaime e Irene.",
    "Crea las tareas del martes y miércoles para pre-carga en almacén y recogida del Camión Albacar con 90 sillas extra.",
    "Genera la logística inversa de domingo y lunes para descarga de los 3 camiones y devolución de material a Dealde."
  ];

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setGeneratedJson(null);

    const activeApiKey = apiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY;

    // Fallback Mock AI Generator if no API Key or for offline demo
    if (!activeApiKey) {
      setTimeout(() => {
        const mockResult = {
          meta: {
            week: "Semana (IA Generada)",
            dateRange: "Fechas generadas por Asistente Gemini AI",
            status: "Operativa Activa (IA)"
          },
          schedule: {
            martes: {
              title: "Martes", badge: "IA Flota",
              tasks: [
                { id: "ia1", text: "Revisión de combustible en Camión Gula y Covey.", location: "Nave Base Gula", timeFrame: "09:00 - 10:30", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Paterna", assigned: ["Gonzalo"], completed: false },
                { id: "ia2", text: "Recogida de Camión Albacar y flejado de cargas.", location: "Albacar Rent", timeFrame: "11:30 - 13:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Albacar+Alquiler+Camiones", assigned: ["Ricardo"], completed: false }
              ]
            },
            miercoles: {
              title: "Miércoles", badge: "IA Pre-carga",
              tasks: [
                { id: "ia3", text: "Carga en frío y menaje para eventos.", location: "Almacén Principal", timeFrame: "10:00 - 14:00", mapsUrl: "", assigned: ["Johan", "Jeferson"], completed: false }
              ]
            },
            jueves: {
              title: "Jueves", badge: "IA Logística",
              tasks: [
                { id: "ia4", text: "Control y validación de albaranes de salida.", location: "Almacén Principal", timeFrame: "15:00 - 17:00", mapsUrl: "", assigned: ["Raúl", "Irene"], completed: false }
              ]
            },
            viernes: {
              title: "Viernes", badge: "IA Cierre",
              tasks: [
                { id: "ia5", text: "Carga final y precintado de los 3 camiones.", location: "Base Logística", timeFrame: "16:00 - 21:00", mapsUrl: "", assigned: ["Gonzalo", "Ricardo", "Jaime"], completed: false }
              ]
            }
          },
          saturdaySpecial: {
            title: "Sábado — Eventos Simultáneos (Gemini AI)",
            weddings: [
              { location: "Sot de Chera", truck: "Camión 1 (Gula)", details: "Conduce: Ricardo | Apoyo: Jeferson.", assigned: ["Ricardo", "Jeferson"], timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sot+de+Chera" },
              { location: "Mas dels Refranys", truck: "Camión 2 (Covey)", details: "Conduce: Gonzalo | Apoyo: Johan.", assigned: ["Gonzalo", "Johan"], timeFrame: "11:00 - 01:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys" },
              { location: "Evento Especial 3", truck: "Camión 3 (Albacar)", details: "Conduce: Jaime | Apoyo: Johan.", assigned: ["Jaime", "Johan"], timeFrame: "13:00 - 00:00", mapsUrl: "" }
            ]
          },
          sundayMonday: {
            title: "Domingo & Lunes — Logística Inversa (IA)",
            tasks: [
              { id: "ias1", text: "Descarga completa en almacén y limpieza de vajilla.", location: "Almacén", timeFrame: "09:00 - 14:00", mapsUrl: "", assigned: ["Jeferson", "Johan"], completed: false },
              { id: "ias2", text: "Devolución de Camión Albacar y material de alquiler.", location: "Dealde", timeFrame: "10:00 - 13:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dealde+Paterna", assigned: ["Gonzalo", "Ricardo"], completed: false }
            ]
          }
        };

        setGeneratedJson(mockResult);
        setLoading(false);
      }, 1500);
      return;
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeApiKey}`;
      
      const systemPrompt = `Eres el Asistente Experto en Logística de "Gula Logística".
REGLAS DE NEGOCIO IMPORTANTES:
1. Para las tareas de RECOGIDA, asigna SIEMPRE a una sola persona, a menos que el usuario pida explícitamente que asigne a dos.
2. Irene y Raúl NO hacen cargas ni descargas, NO los asignes a esas tareas bajo ningún concepto. Jose y Kerly SOLO hacen limpieza de vajilla y utensilios en eventos, NUNCA cargas, descargas ni montaje de estructura. Jeferson SÍ ayuda como apoyo en cargas, descargas y montaje de estructura cuando hace falta.
3. Al planificar recogidas (especialmente recogidas de camión), prográmalas SIEMPRE por la mañana temprano, a menos que se indique lo contrario.
4. Cuando se descargue en un evento, ten en cuenta que también hay MONTAJE DE ESTRUCTURA. Esto debe reflejarse en el texto y el tiempo estimado de la tarea.
5. Genera las tareas como OBJETOS, intentando siempre separar el texto de la tarea (ej: "Recoger material") del horario (ej: "09:00 - 11:30") y de la ubicación (ej: "Dealde").
6. Para cada tarea, si es fuera de la base, GENERA UN ENLACE DE GOOGLE MAPS válido para la ubicación usando este formato exacto: "https://www.google.com/maps/search/?api=1&query=Nombre+Del+Sitio". Si es en la base, déjalo vacío "".
7. Te pasaré la SEMANA ACTUAL en formato JSON. Si el usuario te pide un cambio o ajuste, MODIFICA el JSON actual de forma inteligente, preservando lo que no cambie, y devuelve el JSON completo actualizado.

Este es el JSON ACTUAL de la semana (únelo con los cambios que pide el usuario):
${JSON.stringify(activeWeekData || {}, null, 2)}

Genera una respuesta EXCLUSIVAMENTE en formato JSON válido sin texto previo ni posterior, con TODAS LAS CLAVES ORIGINALES Y TUS CAMBIOS, siguiendo esta estructura exacta:
{
  "meta": { "week": "Semana X", "dateRange": "Fechas", "status": "Operativa Activa" },
  "schedule": {
    "martes": { "title": "Martes", "badge": "Arranque", "tasks": [{ "id": "m1", "text": "Texto", "location": "Dealde", "timeFrame": "09:00 - 11:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Dealde", "assigned": ["Gonzalo"], "completed": false }] },
    "miercoles": { "title": "Miércoles", "badge": "Pre-carga", "tasks": [...] },
    "jueves": { "title": "Jueves", "badge": "Eventos", "tasks": [...] },
    "viernes": { "title": "Viernes", "badge": "Cierre", "tasks": [...] }
  },
  "saturdaySpecial": {
    "title": "Sábado — Eventos Simultáneos",
    "weddings": [{ "location": "Lugar", "truck": "Camión X", "details": "Detalles", "timeFrame": "10:00 - 02:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Lugar", "assigned": ["Gonzalo"] }]
  },
  "sundayMonday": {
    "title": "Domingo & Lunes — Logística Inversa",
    "tasks": [{ "id": "sl1", "text": "Texto", "location": "Almacén", "timeFrame": "09:00 - 14:00", "mapsUrl": "", "assigned": ["Jeferson"], "completed": false }]
  }
}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nSolicitud del usuario: ${prompt}` }] }
          ]
        })
      });

      if (!res.ok) throw new Error(`Error Gemini API (${res.status})`);

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setGeneratedJson(parsed);
      } else {
        throw new Error('La respuesta de Gemini no contenía un JSON válido.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`Error al conectar con Gemini: ${err.message}. Mostrando vista previa demostrativa.`);
    } finally {
      setLoading(false);
    }
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
              placeholder="Escribe tu solicitud (ej: Planifica la Semana 4 para 2 bodas en Sot de Chera y asigna los 3 camiones a Gonzalo, Ricardo, Jaime e Irene)..."
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
