import React from 'react';
import { Truck, Package, Calendar, Coins, ChartBar, Star, Boxes, MapPin, Globe } from 'lucide-react';

export default function BackgroundAnimation({ viewMode = 'worker' }) {
  // Configuración de iconos según la vista activa
  const config = {
    partner_planning: {
      icons: [Calendar, Truck, Boxes, MapPin, Package],
      colorA: 'bg-indigo-500/10',
      colorB: 'bg-purple-500/10',
      colorC: 'bg-blue-500/10',
      iconColor: 'text-indigo-500'
    },
    partner_balances: {
      icons: [Coins, ChartBar, Star, Coins, ChartBar],
      colorA: 'bg-amber-500/10',
      colorB: 'bg-orange-500/10',
      colorC: 'bg-rose-500/10',
      iconColor: 'text-amber-500'
    },
    worker: {
      icons: [Truck, Package, MapPin, Calendar, Boxes],
      colorA: 'bg-emerald-500/10',
      colorB: 'bg-teal-500/10',
      colorC: 'bg-cyan-500/10',
      iconColor: 'text-emerald-500'
    },
    public: {
      icons: [Globe, Star, Package, MapPin, Boxes],
      colorA: 'bg-blue-500/10',
      colorB: 'bg-cyan-500/10',
      colorC: 'bg-indigo-500/10',
      iconColor: 'text-blue-500'
    }
  };

  const theme = config[viewMode] || config.worker;

  // Parámetros de animación fijos para evitar que React re-rendere 
  // posiciones aleatorias en cada tick
  const floatingElements = [
    { Icon: theme.icons[0], left: '10%', top: '20%', size: 'w-16 h-16', delay: '0s', duration: '12s' },
    { Icon: theme.icons[1], left: '80%', top: '15%', size: 'w-24 h-24', delay: '2s', duration: '15s' },
    { Icon: theme.icons[2], left: '25%', top: '70%', size: 'w-20 h-20', delay: '1s', duration: '14s' },
    { Icon: theme.icons[3], left: '75%', top: '80%', size: 'w-16 h-16', delay: '3s', duration: '11s' },
    { Icon: theme.icons[4], left: '50%', top: '45%', size: 'w-28 h-28', delay: '4s', duration: '18s' },
  ];

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Ambient Gradient Orbs (GPU accelerated, very performant) */}
      <div className={`absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-60 animate-float ${theme.colorA}`} style={{ animationDuration: '20s' }}></div>
      <div className={`absolute top-[40%] -right-[10%] w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-50 animate-float ${theme.colorB}`} style={{ animationDuration: '25s', animationDelay: '5s' }}></div>
      <div className={`absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] rounded-full blur-[120px] opacity-40 animate-float ${theme.colorC}`} style={{ animationDuration: '22s', animationDelay: '2s' }}></div>
      
      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-[0.03]"></div>

      {/* Floating Icons */}
      {floatingElements.map((el, i) => {
        const { Icon } = el;
        return (
          <div
            key={i}
            className={`absolute opacity-[0.03] ${theme.iconColor} animate-float`}
            style={{
              left: el.left,
              top: el.top,
              animationDelay: el.delay,
              animationDuration: el.duration
            }}
          >
            <Icon className={`${el.size}`} strokeWidth={1} />
          </div>
        );
      })}
    </div>
  );
}
