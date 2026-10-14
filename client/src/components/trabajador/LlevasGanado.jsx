import EnVivo from '../ui/EnVivo';
import { costeEnCurso } from '../../data/costeEnVivo';
import { formatearEuros } from '../../data/formatoFinanciero';
import { tarifaDe } from '../../data/tarifas';

// Lo que lleva ganado en este turno, subiendo en directo (no se pinta en nómina fija: no
// cobra por horas). Es aproximado — la tarifa del fichaje, sin la bolsa de horas ni el
// redondeo a la media hora al fichar la salida: lo que cuenta es lo de Saldos & Acuerdos.
export default function LlevasGanado({ turno, trabajador }) {
  const tarifa = turno.rate || tarifaDe(trabajador);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">Llevas ganado</span>
      <span className="whitespace-nowrap font-mono text-base font-extrabold tabular-nums text-emerald-300">
        ≈ <EnVivo>{(ahora) => formatearEuros(costeEnCurso({ entrada: turno, ahora, tarifa }).coste)}</EnVivo>
      </span>
      <span className="w-full text-[11px] text-slate-400">A {formatearEuros(tarifa)}/h. Aproximado: el importe final se ajusta al fichar la salida.</span>
    </div>
  );
}
