import { useState } from 'react';
import { AlertTriangle, Check, Euro, Save } from 'lucide-react';
import { Campo, Input } from '../ui/Campo';
import { sinTarifa } from '../../data/tarifasPorDefecto';

const CAMPOS = [
  { clave: 'extra', etiqueta: 'Fuera de nómina (€/h)', ayuda: 'Quien no tiene la suya en su ficha.' },
  { clave: 'nomina', etiqueta: 'En nómina fija (€/h)', ayuda: 'Valoración interna de quien está en nómina.' },
  { clave: 'transporte', etiqueta: 'Ayuda de transporte (€/día)', ayuda: 'A quien lo tiene activado en Saldos.' },
];

const comoTexto = (tarifas = {}) => Object.fromEntries(CAMPOS.map(({ clave }) => [clave, tarifas[clave] ? String(tarifas[clave]) : '']));

// Las tarifas por defecto del equipo. Viven en la base de datos (no en el código): se usan
// cuando alguien no tiene la suya en su ficha, y la ayuda de transporte de los apuntes de
// Saldos. Vacía = sin dato: la app avisa en vez de inventar una cifra.
//
// Props: tarifas ({ extra, nomina, transporte } guardadas), equipo (para avisar de quién
// se queda sin tarifa) y onGuardar(tarifas) → true si se guardó.
export default function TarifasPorDefecto({ tarifas = {}, equipo = [], onGuardar }) {
  const [valores, setValores] = useState(() => comoTexto(tarifas));
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [guardando, setGuardando] = useState(false);
  const sin = sinTarifa(equipo);
  const falta = CAMPOS.some(({ clave }) => !tarifas[clave]);
  // Abierta al entrar si falta algo; después la decide quien la abre o la cierra (si se
  // pusiera `open={falta}`, al guardar se cerraría sola y no se vería «Guardadas.»).
  const [abierta, setAbierta] = useState(falta || sin.length > 0);

  const guardar = async (e) => {
    e.preventDefault();
    const limpias = {};
    for (const { clave, etiqueta } of CAMPOS) {
      const texto = String(valores[clave]).trim().replace(',', '.');
      if (!texto) continue;
      const numero = Number(texto);
      if (!(numero > 0 && numero <= 100)) { setMensaje({ tipo: 'error', texto: `«${etiqueta}»: pon un número entre 0 y 100, o déjalo vacío.` }); return; }
      limpias[clave] = numero;
    }
    setGuardando(true);
    const ok = await onGuardar(limpias);
    setGuardando(false);
    setMensaje(ok ? { tipo: 'ok', texto: 'Guardadas.' } : { tipo: 'error', texto: 'No se pudieron guardar. Revisa la conexión y la sesión de admin.' });
  };

  return (
    <details open={abierta} onToggle={(e) => setAbierta(e.currentTarget.open)} className="group rounded-2xl border border-slate-800 bg-slate-950/50 p-3.5 sm:p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-200 marker:content-none">
        <Euro className="h-4 w-4 text-amber-400" aria-hidden="true" />
        Tarifas por defecto
        {(falta || sin.length > 0) && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">falta alguna</span>}
      </summary>

      <form onSubmit={guardar} noValidate className="mt-3 space-y-3" aria-label="Tarifas por defecto">
        <p className="text-[11px] leading-snug text-slate-400">
          Se usan cuando alguien no tiene la suya en su ficha. Se guardan en la base de datos: ni el código ni el repositorio llevan ninguna cifra.
        </p>
        {sin.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span>Sin tarifa (ni la suya ni la por defecto): {sin.map(w => w.name).join(', ')}. Sus horas salen a 0 € hasta que la pongas.</span>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {CAMPOS.map(({ clave, etiqueta, ayuda }) => (
            <Campo key={clave} etiqueta={etiqueta} compacta ayuda={ayuda}>
              <Input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={valores[clave]} onChange={(e) => setValores(v => ({ ...v, [clave]: e.target.value }))} acento="emerald" />
            </Campo>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={guardando} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:opacity-95 disabled:opacity-50">
            <Save className="h-4 w-4" aria-hidden="true" /> Guardar tarifas
          </button>
          {mensaje && (
            <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-xs font-semibold ${mensaje.tipo === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {mensaje.tipo === 'ok' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{mensaje.texto}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
