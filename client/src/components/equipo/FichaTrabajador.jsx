import React, { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import Boton from '../ui/Boton';
import { Campo, Input, Selector } from '../ui/Campo';
import { agruparRestricciones, OPCIONES_DIA, restriccionesDeFormulario, textoGrupo, TIPOS_DISPONIBILIDAD } from '../../data/disponibilidad';

const NUEVA = { dia: 'semana', tipo: 'solo', desde: '', hasta: '' };

// La ficha de una persona del equipo: rol, "solo si hace falta", una nota y su
// disponibilidad FIJA (para todas las semanas: "desde las 15:00", "no los lunes").
// La respetan el reparto, el calendario y Gemini. El nombre no se cambia aquí: de él
// cuelgan sus fichajes y su saldo.
// `onGuardar(cambios)` → true si se guardó.
export default function FichaTrabajador({ trabajador, onGuardar, onCerrar }) {
  const [role, setRole] = useState(trabajador.role || '');
  const [backup, setBackup] = useState(trabajador.backup === true);
  const [nota, setNota] = useState(trabajador.nota || '');
  const [disponibilidad, setDisponibilidad] = useState(Array.isArray(trabajador.disponibilidad) ? trabajador.disponibilidad : []);
  const [nueva, setNueva] = useState(NUEVA);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const anadir = () => {
    const { restricciones, error } = restriccionesDeFormulario({ ...nueva, persona: trabajador.name });
    if (error) { setMensaje({ tipo: 'error', texto: error }); return; }
    setDisponibilidad(d => [...d, ...restricciones.map(({ dia, tipo, desde = '', hasta = '' }) => ({ dia, tipo, desde, hasta }))]);
    setNueva(NUEVA);
    setMensaje(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    const ok = await onGuardar({ role: role.trim(), backup, nota: nota.trim().slice(0, 120), disponibilidad });
    setGuardando(false);
    setMensaje(ok ? { tipo: 'ok', texto: 'Guardado.' } : { tipo: 'error', texto: 'No se pudo guardar: vuelve a iniciar sesión de administrador y repítelo.' });
  };

  const campo = (clave) => ({ value: nueva[clave], onChange: (e) => setNueva(n => ({ ...n, [clave]: e.target.value })) });

  return (
    <form onSubmit={guardar} className="space-y-3 rounded-xl border border-emerald-500/30 bg-slate-950 p-3">
      <Campo etiqueta="Rol">
        <Input id={`rol-${trabajador.name}`} value={role} onChange={(e) => setRole(e.target.value)} tamano="sm" acento="emerald" />
      </Campo>
      <label className="flex items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} className="mt-0.5 accent-emerald-500" />
        <span>Solo si hace falta <span className="text-slate-500">(entra cuando los demás van cargados)</span></span>
      </label>
      <Campo etiqueta="Nota">
        <Input id={`nota-${trabajador.name}`} value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: cuando no está en cocina" tamano="sm" acento="emerald" />
      </Campo>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Disponibilidad fija <span className="whitespace-nowrap normal-case tracking-normal text-slate-500">(todas las semanas)</span></p>
        {disponibilidad.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {/* Agrupadas por días: "desde las 15:00 de lunes a viernes" es una sola etiqueta. */}
            {agruparRestricciones(disponibilidad.map(r => ({ ...r, persona: trabajador.name, fija: true }))).map(g => (
              <li key={g.indices.join('-')} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 py-0.5 pl-2 pr-0.5 text-xs text-slate-200">
                {textoGrupo(g, { conPersona: false })}
                <button type="button" onClick={() => setDisponibilidad(d => d.filter((_, j) => !g.indices.includes(j)))} aria-label={`Quitar: ${textoGrupo(g, { conPersona: false })}`} className="rounded p-1 text-slate-500 hover:text-rose-300">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Selector id={`fija-dia-${trabajador.name}`} tamano="sm" aria-label="Día" acento="emerald" {...campo('dia')}>
            {OPCIONES_DIA.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </Selector>
          <Selector id={`fija-tipo-${trabajador.name}`} tamano="sm" aria-label="Qué pasa" acento="emerald" {...campo('tipo')}>
            {Object.entries(TIPOS_DISPONIBILIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selector>
          {nueva.tipo === 'solo' && (
            <>
              <Input id={`fija-desde-${trabajador.name}`} type="time" tamano="sm" aria-label="Desde" acento="emerald" {...campo('desde')} />
              <Input id={`fija-hasta-${trabajador.name}`} type="time" tamano="sm" aria-label="Hasta" acento="emerald" {...campo('hasta')} />
              <p className="text-[11px] text-slate-500 min-[360px]:col-span-2">Con una sola hora basta: «desde» vacío es «hasta esa hora» y «hasta» vacío, «a partir de esa hora».</p>
            </>
          )}
        </div>
        <Boton variante="dashed" className="w-full text-xs" onClick={anadir}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir disponibilidad
        </Boton>
      </div>

      {mensaje && <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-xs ${mensaje.tipo === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{mensaje.texto}</p>}
      <div className="flex flex-wrap gap-2">
        <Boton tipo="submit" variante="primario" className="text-xs" disabled={guardando}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar ficha'}
        </Boton>
        <Boton variante="secundario" className="text-xs" onClick={onCerrar}>Cerrar</Boton>
      </div>
    </form>
  );
}
