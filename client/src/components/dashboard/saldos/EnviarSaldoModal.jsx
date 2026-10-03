import React, { useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, RefreshCw, Send, Users } from 'lucide-react';
import Modal from '../../ui/Modal';
import CabeceraModal from '../../ui/CabeceraModal';
import { AreaTexto, Campo } from '../../ui/Campo';
import { mensajeDeSaldo } from '../../../data/mensajeSaldo';
import { abrirEnPestanaNueva, enlaceTrabajador, enlaceWhatsApp, telefonoWhatsApp } from '../../../data/enlaces';
import { coincideNombre } from '../../../data/nombresTrabajadores';
import { useEnlacesTrabajadores } from '../../../hooks/useEnlacesTrabajadores';
import { useCopiado } from '../../../hooks/useCopiado';

// Qué puede llevar el mensaje, además del saldo y las horas.
const PARTES = [
  ['turnos', 'Turnos fichados'],
  ['aMano', 'Apuntado a mano y pagos'],
  ['enlace', 'Su enlace personal'],
];

// Enviar el saldo de una persona por WhatsApp: el mensaje (mensajeDeSaldo, la misma
// cuenta que Saldos) se ve y se puede retocar antes de mandarlo. Se manda a su teléfono
// si su ficha lo tiene, a cualquier otro contacto (se elige en WhatsApp) o se copia.
//
// Props: datos { ficha, saldo, turnos, turnosHoras } (null = cerrado), admin (solo con
// sesión de admin va su enlace personal firmado), equipo (para el nombre del enlace y
// su teléfono si la ficha no lo trae) y onCerrar. El llamador lo monta al abrirlo (con
// `key` por persona): así el mensaje sale a la hora de abrirlo y sin lo de otra persona.
export default function EnviarSaldoModal({ datos, admin = false, equipo = [], onCerrar }) {
  const abierto = !!datos;
  const { tokenDe, cargando } = useEnlacesTrabajadores(abierto && admin);
  const [incluir, setIncluir] = useState({ turnos: true, aMano: true, enlace: true });
  const [editado, setEditado] = useState(null); // el texto retocado a mano, o null
  const [ahora] = useState(() => new Date());
  const [copiado, copiar] = useCopiado();

  const persona = useMemo(() => (datos ? equipo.find(w => coincideNombre(w.name, datos.ficha.name)) : null), [datos, equipo]);
  const token = datos && admin ? tokenDe(datos.ficha.name) : null;
  const enlace = token ? enlaceTrabajador(persona?.name || datos.ficha.name, token) : null;
  const generado = useMemo(
    () => (datos ? mensajeDeSaldo({ ...datos, ahora, incluir, enlace }) : ''),
    [datos, ahora, incluir, enlace]
  );

  if (!abierto) return null;

  const texto = editado ?? generado;
  const nombre = persona?.name || datos.ficha.name;
  const telefono = telefonoWhatsApp(datos.ficha.phone || persona?.phone);
  const alternar = (clave) => { setIncluir(i => ({ ...i, [clave]: !i[clave] })); setEditado(null); };
  const boton = 'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors';

  return (
    <Modal onCerrar={onCerrar} ancho="lg" etiqueta={`Enviar el saldo de ${nombre} por WhatsApp`}>
      <CabeceraModal icono={MessageCircle} tono="emerald" titulo="Enviar saldo por WhatsApp" subtitulo={nombre} className="mb-5 pr-10" />

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Qué lleva el mensaje</legend>
        <div className="flex flex-wrap gap-2">
          {PARTES.map(([clave, etiqueta]) => {
            const sinEnlace = clave === 'enlace' && !enlace;
            return (
              <button
                key={clave}
                type="button"
                onClick={() => alternar(clave)}
                disabled={sinEnlace}
                aria-pressed={incluir[clave] && !sinEnlace}
                title={sinEnlace ? (cargando ? 'Preparando su enlace…' : 'Solo con sesión de admin y si tiene ficha de Saldos') : undefined}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${incluir[clave] && !sinEnlace ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'}`}
              >
                {etiqueta}{clave === 'enlace' && cargando ? '…' : ''}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Campo etiqueta="Mensaje (puedes retocarlo)">
        <AreaTexto value={texto} onChange={e => setEditado(e.target.value)} rows={12} acento="emerald" className="w-full font-mono text-xs leading-relaxed" />
      </Campo>
      {editado !== null && (
        <button type="button" onClick={() => setEditado(null)} className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300">
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> Volver al mensaje generado
        </button>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {telefono ? (
          <button type="button" onClick={() => abrirEnPestanaNueva(enlaceWhatsApp(texto, telefono))} className={`${boton} bg-emerald-600 text-white hover:bg-emerald-500 sm:col-span-3`}>
            <Send className="h-4 w-4" aria-hidden="true" /> Enviar a {nombre}
          </button>
        ) : (
          <p className="text-[11px] text-slate-400 sm:col-span-3">Su ficha no tiene teléfono: elige el contacto en WhatsApp.</p>
        )}
        <button type="button" onClick={() => abrirEnPestanaNueva(enlaceWhatsApp(texto))} className={`${boton} ${telefono ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-500'} sm:col-span-2`}>
          <Users className="h-4 w-4" aria-hidden="true" /> {telefono ? 'Mandarlo a otro contacto' : 'Elegir contacto en WhatsApp'}
        </button>
        <button type="button" onClick={() => copiar(texto)} className={`${boton} bg-slate-800 text-slate-200 hover:bg-slate-700`}>
          {copiado ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copiado ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
    </Modal>
  );
}
