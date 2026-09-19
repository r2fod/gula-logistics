import React from 'react';
import { Truck, Package, Calendar, Coins, ChartBar, Star, Boxes, MapPin } from 'lucide-react';

export default function BackgroundAnimation({ viewMode = 'worker' }) {
  // Configuración de iconos según la vista activa
  const iconSets = {
    partner_planning: [Calendar, Truck, Boxes, MapPin, Package],
    partner_balances: [Coins, ChartBar, Star, Coins, ChartBar],
    worker: [Truck, Package, MapPin, Calendar, Boxes],
    public: [Truck, Star, Package, MapPin, Boxes]
  };

  const currentIcons = iconSets[viewMode] || iconSets.worker;

  // Parámetros de animación fijos para evitar que React re-rendere 
  // posiciones aleatorias en cada tick
  const floatingElements = [
    { Icon: currentIcons[0], left: '10%', top: '20%', size: 'w-16 h-16', delay: '0s', duration: '12s' },
    { Icon: currentIcons[1], left: '80%', top: '15%', size: 'w-24 h-24', delay: '2s', duration: '15s' },
    { Icon: currentIcons[2], left: '25%', top: '70%', size: 'w-20 h-20', delay: '1s', duration: '14s' },
    { Icon: currentIcons[3], left: '75%', top: '80%', size: 'w-16 h-16', delay: '3s', duration: '11s' },
    { Icon: currentIcons[4], left: '50%', top: '45%', size: 'w-28 h-28', delay: '4s', duration: '18s' },
  ];

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {floatingElements.map((el, i) => {
        const { Icon } = el;
        return (
          <div
            key={i}
            className="absolute opacity-[0.03] text-amber-500 animate-float"
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
