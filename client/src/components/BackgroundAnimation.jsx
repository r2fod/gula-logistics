import React from 'react';
import {
  Boxes, Calendar, ChartBar, ChartPie, ClipboardList, Clock, Coins, Globe, ListChecks, LogIn, LogOut,
  MapPin, Network, Package, PiggyBank, Radio, Receipt, Route, Star, Timer, TrendingUp, Truck, UserCheck,
  Wallet, Waypoints, Zap,
} from 'lucide-react';

// Fondo animado de cada página: mismos elementos (tres manchas de luz difuminadas,
// una rejilla tenue y cinco iconos) con los colores, los iconos y el MOVIMIENTO propios
// de cada una. Los colores son los de su pestaña (panel/pestanas.js).
//
// Rendimiento: solo se anima `transform` y `opacity` (los mueve la GPU, sin repintar);
// el difuminado se calcula una vez. Con "reducir movimiento" se queda quieto, y con la
// app en segundo plano el navegador no anima nada. Los movimientos (`fondo-*`) están en
// index.css.
const TEMAS = {
  live: { movimiento: 'latir', iconos: [Radio, UserCheck, Clock, MapPin, Truck], orbes: ['bg-emerald-500/10', 'bg-teal-500/10', 'bg-cyan-500/10'], color: 'text-emerald-400' },
  schedule: { movimiento: 'barrer', iconos: [Calendar, ListChecks, Clock, Truck, Boxes], orbes: ['bg-sky-500/10', 'bg-indigo-500/10', 'bg-blue-500/10'], color: 'text-sky-400' },
  graph: { movimiento: 'orbitar', iconos: [Zap, Network, Waypoints, Boxes, MapPin], orbes: ['bg-amber-500/10', 'bg-violet-500/10', 'bg-indigo-500/10'], color: 'text-amber-400' },
  logistics: { movimiento: 'derivar', iconos: [Truck, Route, Package, MapPin, Truck], orbes: ['bg-blue-500/10', 'bg-cyan-500/10', 'bg-sky-500/10'], color: 'text-blue-400' },
  balances: { movimiento: 'flotar', iconos: [Coins, Wallet, PiggyBank, Receipt, Star], orbes: ['bg-emerald-500/10', 'bg-amber-500/10', 'bg-teal-500/10'], color: 'text-emerald-400' },
  financial: { movimiento: 'subir', iconos: [ChartBar, TrendingUp, ChartPie, Coins, Wallet], orbes: ['bg-amber-500/10', 'bg-orange-500/10', 'bg-rose-500/10'], color: 'text-amber-400' },
  fichajes: { movimiento: 'pendulo', iconos: [ClipboardList, Clock, LogIn, LogOut, Timer], orbes: ['bg-indigo-500/10', 'bg-violet-500/10', 'bg-blue-500/10'], color: 'text-indigo-400' },
  worker: { movimiento: 'flotar', iconos: [Truck, Package, MapPin, Calendar, Boxes], orbes: ['bg-emerald-500/10', 'bg-teal-500/10', 'bg-cyan-500/10'], color: 'text-emerald-500' },
  public: { movimiento: 'derivar', iconos: [Globe, Star, Package, MapPin, Boxes], orbes: ['bg-blue-500/10', 'bg-cyan-500/10', 'bg-indigo-500/10'], color: 'text-blue-500' },
};

// Posición, tamaño y ritmo fijos (no aleatorios: así no cambian al repintar).
const ORBES = [
  { clase: '-top-[20%] -left-[10%] w-[50vw] h-[50vw] blur-[100px] opacity-60', duracion: '20s', retraso: '0s' },
  { clase: 'top-[40%] -right-[10%] w-[40vw] h-[40vw] blur-[100px] opacity-50', duracion: '25s', retraso: '-5s' },
  { clase: '-bottom-[20%] left-[20%] w-[60vw] h-[60vw] blur-[120px] opacity-40', duracion: '22s', retraso: '-11s' },
];
const ICONOS = [
  { left: '10%', top: '20%', tamano: 'w-16 h-16', duracion: '12s', retraso: '0s' },
  { left: '80%', top: '15%', tamano: 'w-24 h-24', duracion: '15s', retraso: '-2s' },
  { left: '25%', top: '70%', tamano: 'w-20 h-20', duracion: '14s', retraso: '-6s' },
  { left: '75%', top: '80%', tamano: 'w-16 h-16', duracion: '11s', retraso: '-3s' },
  { left: '50%', top: '45%', tamano: 'w-28 h-28', duracion: '18s', retraso: '-9s' },
];

// `viewMode`: la pestaña del panel (live, schedule, graph…), 'worker' o 'public'.
export default function BackgroundAnimation({ viewMode = 'worker' }) {
  const tema = TEMAS[viewMode] || TEMAS.worker;
  const mover = `fondo-${tema.movimiento}`;

  return (
    <div className="fondo-animado fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {ORBES.map((o, i) => (
        <div
          key={i}
          className={`absolute rounded-full transition-colors duration-1000 ${o.clase} ${tema.orbes[i]} ${mover}`}
          style={{ animationDuration: o.duracion, animationDelay: o.retraso }}
        />
      ))}

      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-[0.03]" />

      {ICONOS.map((el, i) => {
        const Icono = tema.iconos[i];
        return (
          <div
            key={i}
            className={`absolute opacity-[0.05] transition-colors duration-1000 ${tema.color} ${mover}`}
            style={{ left: el.left, top: el.top, animationDuration: el.duracion, animationDelay: el.retraso }}
          >
            <Icono className={el.tamano} strokeWidth={1} />
          </div>
        );
      })}
    </div>
  );
}
