import React from 'react';
import { ShieldCheck, Share2, Copy, Check, MessageCircle, ExternalLink } from 'lucide-react';
import { getStoredAdminToken } from '../data/apiService';
import { enlaceTrabajador, enlaceSocias, enlaceWhatsApp } from '../data/enlaces';
import { useCopiado } from '../hooks/useCopiado';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';

// Enlaces para compartir: el de las socias (con la sesión de admin dentro si la
// hay, para que entren sin clave) y uno por trabajador, para copiar, mandar
// por WhatsApp o abrir.
//
// Props: abierto, onCerrar, workersList, weekId y weekName (la semana del enlace).
export default function EnlacesWhatsAppModal({ abierto, onCerrar, workersList = [], weekId, weekName }) {
  const [copiadoSocias, copiarSocias] = useCopiado();
  const [copiadoTrabajador, copiarTrabajador] = useCopiado();

  if (!abierto) return null;

  const enlaceSociasActual = enlaceSocias(getStoredAdminToken());

  const compartirSocias = () => {
    const texto = `🔒 Hola Socias, aquí tenéis el Enlace Seguro de Dirección para Gula Logística (Planificación + Saldos de Horas): ${enlaceSociasActual}`;
    window.open(enlaceWhatsApp(texto), '_blank');
  };

  const compartirTrabajador = (nombre) => {
    const texto = `🚚 Hola ${nombre}, aquí tienes tu planificación y fichaje para ${weekName} de Gula Logística: ${enlaceTrabajador(weekId, nombre)}`;
    window.open(enlaceWhatsApp(texto), '_blank');
  };

  return (
    <Modal onCerrar={onCerrar} ancho="xl" className="overflow-x-hidden">
      <CabeceraModal
        icono={Share2}
        tono="blue"
        titulo="Enlaces de WhatsApp"
        subtitulo="Envía a cada trabajador o socia su enlace seguro"
        className="mb-6"
      />

      {/* Partner Link Box */}
      <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Enlace para Socias (1 Clic - Sin clave)</span>
          </span>
          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">SOCIAS</span>
        </div>

        <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 min-w-0">
          <input
            type="text"
            readOnly
            value={enlaceSociasActual}
            className="bg-transparent text-xs text-amber-300/90 font-mono w-full min-w-0 focus:outline-none select-all truncate"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1 w-full">
          <button
            onClick={() => copiarSocias(enlaceSociasActual)}
            className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors border border-slate-700 whitespace-nowrap"
          >
            {copiadoSocias ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link Socias</span>
              </>
            )}
          </button>

          <button
            onClick={compartirSocias}
            className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20 whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp Socias</span>
          </button>
        </div>
      </div>

      {/* Workers List */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto overflow-x-hidden pr-1 no-scrollbar">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Enlaces de Trabajadores</span>
        {workersList.map((w, idx) => (
          <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center space-x-3 min-w-0 flex-1 w-full">
              <span className="text-2xl shrink-0">{w.avatar}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-white text-sm truncate">{w.name}</h4>
                  {w.isPayroll ? (
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">Nómina</span>
                  ) : (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">10€/h</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate" title={w.role}>{w.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => copiarTrabajador(enlaceTrabajador(weekId, w.name), w.name)}
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copiadoTrabajador === w.name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>

              <button
                onClick={() => compartirTrabajador(w.name)}
                className="col-span-1 sm:col-span-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => window.open(enlaceTrabajador(weekId, w.name), '_blank')}
                className="col-span-1 sm:col-span-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-blue-600/20 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
            </div>
          </div>
        ))}
      </div>

    </Modal>
  );
}
