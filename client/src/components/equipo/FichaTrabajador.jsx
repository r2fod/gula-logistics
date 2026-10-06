import React, { useState } from 'react';
import { ArrowLeft, Plus, Save, X } from 'lucide-react';
import Boton from '../ui/Boton';
import { Campo, Input, Selector } from '../ui/Campo';
import SelectorIcono from './SelectorIcono';
import { agruparRestricciones, OPCIONES_DIA, restriccionesDeFormulario, textoGrupo, TIPOS_DISPONIBILIDAD } from '../../data/disponibilidad';
import { useDialog } from '../../contexts/DialogContext';

const NUEVA = { dia: 'semana', tipo: 'solo', desde: '', hasta: '' };
const aRestriccion = ({ dia, tipo, desde = '', hasta = '' }) => ({ dia, tipo, desde, hasta });
// Para saber si hay cambios sin guardar (lo que vuelve del servidor trae campos de más).
const huella = ({ avatar, role, backup, nota, disponibilidad }) =>
  JSON.stringify([avatar, role.trim(), backup, nota.trim(), disponibilidad.map(r => `${r.dia}|${r.tipo}|${r.desde || ''}|${r.hasta || ''}`)]);

// La ficha de una persona del equipo, a todo el ancho de «Gestionar equipo»: icono,
// rol, "solo si hace falta", una nota y su disponibilidad FIJA (para todas las semanas:
// "desde las 15:00", "no los lunes"). La respetan el reparto, el calendario y Gemini.
// El nombre no se cambia aquí: de él cuelgan sus fichajes y su saldo.
// `onGuardar(cambios)` → true si se guardó. `onCerrar` vuelve a la lista.
export default function FichaTrabajador({ trabajador, onGuardar, onCerrar }) {
  const { confirm } = useDialog();
  const inicial = {
    avatar: trabajador.avatar || '👤',
    role: trabajador.role || '',
    backup: trabajador.backup === true,
    nota: trabajador.nota || '',
    disponibilidad: Array.isArray(trabajador.disponibilidad) ? trabajador.disponibilidad : [],
  };
  const [avatar, setAvatar] = useState(inicial.avatar);
  const [role, setRole] = useState(inicial.role);
  const [backup, setBackup] = useState(inicial.backup);
  const [nota, setNota] = useState(inicial.nota);
  const [disponibilidad, setDisponibilidad] = useState(inicial.disponibilidad);
  const [nueva, setNueva] = useState(NUEVA);
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Lo escrito en «disponibilidad» sin pulsar «Añadir» también cuenta al guardar.
  const pendiente = nueva.tipo !== 'solo' || nueva.desde || nueva.hasta;
  const leerNueva = () => {
    const { restricciones, error } = restriccionesDeFormulario({ ...nueva, persona: trabajador.name });
    if (error) { setMensaje({ tipo: 'error', texto: error }); return null; }
    return restricciones.map(aRestriccion);
  };

  const anadir = () => {
    const nuevas = leerNueva();
    if (!nuevas) return;
    setDisponibilidad(d => [...d, ...nuevas]);
    setNueva(NUEVA);
    setMensaje(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const nuevas = pendiente ? leerNueva() : [];
    if (!nuevas) return;
    const todas = [...disponibilidad, ...nuevas];
    if (nuevas.length) { setDisponibilidad(todas); setNueva(NUEVA); }
    setGuardando(true);
    const ok = await onGuardar({ avatar, role: role.trim(), backup, nota: nota.trim().slice(0, 120), disponibilidad: todas });
    setGuardando(false);
    setMensaje(ok ? { tipo: 'ok', texto: 'Guardado.' } : { tipo: 'error', texto: 'No se pudo guardar: vuelve a iniciar sesión de administrador y repítelo.' });
  };

  const volver = async () => {
    const sinGuardar = pendiente || huella({ avatar, role, backup, nota, disponibilidad }) !== huella(inicial);
    if (sinGuardar && !(await confirm('Hay cambios en la ficha que no has guardado. ¿Volver sin guardarlos?', { type: 'warning', title: 'Cambios sin guardar', confirmText: 'Volver sin guardar' }))) return;
    onCerrar();
  };

  const campo = (clave) => ({ value: nueva[clave], onChange: (e) => setNueva(n => ({ ...n, [clave]: e.target.value })) });

  return (
    <form onSubmit={guardar} aria-label={`Ficha de ${trabajador.name}`} className="animate-aparecer space-y-5 motion-reduce:animate-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={volver}
          aria-label="Volver al equipo"
          title="Volver al equipo"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-800/80 text-2xl">{avatar}</span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold leading-tight text-white">{trabajador.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">{role.trim() || 'Sin rol'}</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <SelectorIcono valor={avatar} onCambiar={setAvatar} />
          <Campo etiqueta="Rol">
            <Input id={`rol-${trabajador.name}`} value={role} onChange={(e) => setRole(e.target.value)} acento="emerald" />
          </Campo>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} className="mt-1 accent-emerald-500" />
            <span>Solo si hace falta <span className="text-slate-500">(entra cuando los demás van cargados)</span></span>
          </label>
          <Campo etiqueta="Nota">
            <Input id={`nota-${trabajador.name}`} value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: cuando no está en cocina" acento="emerald" />
          </Campo>
        </div>

        <fieldset className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3.5 sm:p-4">
          <legend className="sr-only">Disponibilidad fija</legend>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Disponibilidad fija <span className="normal-case tracking-normal text-slate-500">(todas las semanas)</span>
          </p>
          {disponibilidad.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {/* Agrupadas por días: "desde las 15:00 de lunes a viernes" es una sola etiqueta. */}
              {agruparRestricciones(disponibilidad.map(r => ({ ...r, persona: trabajador.name, fija: true }))).map(g => (
                <li key={g.indices.join('-')} className="flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 py-0.5 pl-2 pr-0.5 text-xs text-sky-200">
                  {textoGrupo(g, { conPersona: false })}
                  <button type="button" onClick={() => setDisponibilidad(d => d.filter((_, j) => !g.indices.includes(j)))} aria-label={`Quitar: ${textoGrupo(g, { conPersona: false })}`} className="rounded p-1 text-sky-300/70 hover:text-rose-300">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Sin límites: puede cualquier día y a cualquier hora.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Selector id={`fija-dia-${trabajador.name}`} tamano="sm" aria-label="Día" acento="emerald" {...campo('dia')}>
              {OPCIONES_DIA.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </Selector>
            <Selector id={`fija-tipo-${trabajador.name}`} tamano="sm" aria-label="Qué pasa" acento="emerald" {...campo('tipo')}>
              {Object.entries(TIPOS_DISPONIBILIDAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selector>
          </div>
          {nueva.tipo === 'solo' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="Desde" compacta>
                  <Input id={`fija-desde-${trabajador.name}`} type="time" tamano="sm" acento="emerald" {...campo('desde')} />
                </Campo>
                <Campo etiqueta="Hasta" compacta>
                  <Input id={`fija-hasta-${trabajador.name}`} type="time" tamano="sm" acento="emerald" {...campo('hasta')} />
                </Campo>
              </div>
              <p className="text-[11px] leading-snug text-slate-500">Con una sola hora basta: sin «desde» es «hasta esa hora»; sin «hasta», «a partir de esa hora».</p>
            </>
          )}
          <Boton variante="dashed" className="w-full text-xs" onClick={anadir}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir disponibilidad
          </Boton>
        </fieldset>
      </div>

      {mensaje && <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`text-sm ${mensaje.tipo === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{mensaje.texto}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
        <Boton variante="secundario" className="text-sm" onClick={volver}>Volver</Boton>
        <Boton tipo="submit" variante="primario" className="text-sm" disabled={guardando}>
          <Save className="h-4 w-4" aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar ficha'}
        </Boton>
      </div>
    </form>
  );
}
