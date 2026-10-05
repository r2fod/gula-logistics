import React from 'react';
import { ShieldCheck, Share2, Copy, Check, MessageCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { abrirEnPestanaNueva, enlaceTrabajador, enlaceWhatsApp } from '../data/enlaces';
import { useCopiado } from '../hooks/useCopiado';
import { useEnlaceSocias } from '../hooks/useEnlaceSocias';
import { useEnlacesTrabajadores } from '../hooks/useEnlacesTrabajadores';
import { useDialog } from '../contexts/DialogContext';
import { formatDateLong } from '../utils/dateUtils';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';

// Enlaces para compartir: el de las socias (solo lo ve el admin: es un enlace
// de SOLO LECTURA que genera el servidor, caduca y se puede anular) y uno por
// trabajador, para copiar, mandar por WhatsApp o abrir. El de cada trabajador es
// fijo (siempre el mismo, abre la semana en curso), ver data/enlaces.js. Con sesión de
// admin va firmado: así esa persona ve además SU saldo (y solo el suyo).
//
// Props: abierto, onCerrar, workersList y admin.
export default function EnlacesWhatsAppModal({ abierto, onCerrar, workersList = [], admin = false }) {
  const { alert, confirm } = useDialog();
  const [copiadoTrabajador, copiarTrabajador] = useCopiado();
  const { tokenDe, cargando: cargandoFirmas, error: errorFirmas, generar: generarFirmas } = useEnlacesTrabajadores(abierto && admin);

  if (!abierto) return null;

  const enlaceDe = (nombre) => enlaceTrabajador(nombre, admin ? tokenDe(nombre) : null);

  const compartirTrabajador = (nombre) => {
    const conSaldo = admin && tokenDe(nombre);
    const texto = `🚚 Hola ${nombre}, aquí tienes tu planificación y fichaje de Gula Logística${conSaldo ? ' (y tus horas y lo que tienes pendiente de cobro)' : ''}: ${enlaceDe(nombre)}\n\nGuarda este enlace: es siempre el mismo y se actualiza solo cada semana.${conSaldo ? ' Es personal: no lo compartas.' : ''}`;
    abrirEnPestanaNueva(enlaceWhatsApp(texto));
  };

  const anularEnlacesTrabajadores = async () => {
    const seguir = await confirm('Los enlaces personales que ya enviaste dejarán de enseñar el saldo (y de valer para fichar si lo exiges en Configuración). Tendrás que reenviar a cada persona su enlace nuevo. ¿Seguir?', { type: 'warning', confirmText: 'Anular y generar' });
    if (!seguir) return;
    if (await generarFirmas({ anularAnteriores: true })) await alert('Enlaces anteriores anulados. Reenvía a cada persona su enlace nuevo.', { type: 'success' });
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

      {admin && <EnlaceSocias />}

      {/* Workers List */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto overflow-x-hidden pr-1 no-scrollbar">
        <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Enlaces de Trabajadores</span>
        {admin && (
          <p role={errorFirmas ? 'alert' : undefined} className={`text-[11px] ${errorFirmas ? 'text-red-400' : 'text-slate-400'}`}>
            {cargandoFirmas
              ? 'Preparando los enlaces con saldo…'
              : errorFirmas
                ? `Los enlaces salen sin saldo: ${errorFirmas}`
                : 'Cada enlace es personal: con él, esa persona ve también sus horas y lo que tiene pendiente de cobro (solo lo suyo). Reenvíalo una vez para que lo vea.'}
          </p>
        )}
        {admin && (
          <button type="button" disabled={cargandoFirmas} onClick={anularEnlacesTrabajadores} className="w-full sm:w-auto py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50 bg-slate-900 hover:bg-red-950/60 text-red-300 border border-red-900/50">
            <RefreshCw className={`w-3.5 h-3.5 ${cargandoFirmas ? 'animate-spin' : ''}`} />
            <span>Anular enlaces de trabajador enviados</span>
          </button>
        )}
        {workersList.map((w, idx) => (
          <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center space-x-3 min-w-0 flex-1 w-full">
              <span className="text-2xl shrink-0">{w.avatar}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-white text-sm truncate">{w.name}</h4>
                  {w.isPayroll ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">Nómina</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">10€/h</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate" title={w.role}>{w.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => copiarTrabajador(enlaceDe(w.name), w.name)}
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
                onClick={() => abrirEnPestanaNueva(enlaceDe(w.name))}
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

// Caja del enlace de socias. Se monta solo con el modal abierto y sesión de admin,
// así el enlace se pide al servidor justo cuando hace falta.
function EnlaceSocias() {
  const { alert, confirm } = useDialog();
  const [copiado, copiar] = useCopiado();
  const { enlace, caduca, cargando, error, generar } = useEnlaceSocias(true);

  const compartir = () => {
    const texto = `🔒 Hola Socias, aquí tenéis el enlace de Gula Logística (planificación y saldos, solo lectura): ${enlace}`;
    abrirEnPestanaNueva(enlaceWhatsApp(texto));
  };

  const anularAnteriores = async () => {
    const seguir = await confirm('Los enlaces de socias que ya enviaste dejarán de funcionar y tendrás que mandarles este nuevo. ¿Seguir?', { type: 'warning', confirmText: 'Anular y generar' });
    if (!seguir) return;
    if (await generar({ anularAnteriores: true })) await alert('Enlaces anteriores anulados. Envía el nuevo a las socias.', { type: 'success' });
  };

  const boton = 'w-full sm:flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50';

  return (
    <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 min-w-0">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">Enlace para Socias (solo lectura)</span>
        </span>
        <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full shrink-0">SOCIAS</span>
      </div>

      <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 min-w-0">
        <input
          id="enlace-socias"
          type="text"
          readOnly
          aria-label="Enlace para socias"
          value={enlace || (cargando ? 'Generando enlace…' : '')}
          className="bg-transparent text-xs text-amber-300/90 font-mono w-full min-w-0 focus:outline-none select-all truncate"
        />
      </div>
      {error && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" className="text-[11px] text-red-400">No se pudo generar el enlace: {error}</p>
          <button type="button" disabled={cargando} onClick={() => generar()} className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 disabled:opacity-50">
            Reintentar
          </button>
        </div>
      )}
      {caduca && !error && (
        <p className="text-[11px] text-slate-400">Ven la planificación y los saldos, sin poder cambiar nada. Caduca el {formatDateLong(caduca)}.</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1 w-full">
        <button type="button" disabled={!enlace} onClick={() => copiar(enlace)} className={`${boton} bg-slate-800 hover:bg-slate-700 text-white border border-slate-700`}>
          {copiado ? (
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
        <button type="button" disabled={!enlace} onClick={compartir} className={`${boton} bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-md shadow-emerald-600/20`}>
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Socias</span>
        </button>
        <button type="button" disabled={cargando} onClick={anularAnteriores} className={`${boton} bg-slate-900 hover:bg-red-950/60 text-red-300 border border-red-900/50`}>
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          <span>Anular anteriores</span>
        </button>
      </div>
    </div>
  );
}
