import React from 'react';
import { Truck, Users, Calendar, Clock, Flame as Fire, Broom } from 'lucide-react';

export default function App() {
  const data = {
    meta: {
      week: "Semana 3",
      dateRange: "Del 15 al 20 de Septiembre de 2026",
      status: "Operativa Activa"
    },
    team: [
      { role: "Dirección / Cocina / Ventas", members: "Anna y Cliente3" },
      { role: "Jefe Logística", members: "Persona8 (Supervisa y ayuda en base)" },
      { role: "Base & Preparación", members: "Persona4 (Pedidos/Checklist) + Persona5 (Apoyo Log/Prep)" },
      { role: "Flota / Conductores", members: "Persona1 & Persona2 (Veteranos) | Jaime (Guiado) | Persona3 (Backup)" }
    ],
    schedule: {
      martes: {
        title: "Martes 15", badge: "Arranque Flota",
        tasks: [
          "09:00 - 11:30: Recogida Camión Albacar (Persona1 y Persona2). ¡Flota completa de 3!",
          "12:00 - 14:00: Ruta Carvillo — Recogida 90 sillas extra.",
          "15:30 - 18:30: Ruta Empresa5 — Recogida material alquiler."
        ]
      },
      miercoles: {
        title: "Miércoles 16", badge: "Descarga Fincas",
        tasks: [
          "10:00 - 14:00: Pre-carga en almacén (Persona3 y Persona5).",
          "15:00 - 19:00: Descarga adelantada en Mas dels Refranys y Villajoyosa (Persona1, Persona2, Persona3)."
        ]
      },
      jueves: {
        title: "Jueves 17", badge: "Eventos",
        tasks: [
          "08:00 - 14:00: Catering Empresa1 (100 pax) - Anto, Marc, Luis.",
          "15:00 - 19:00: Evento Empresa2 - Control y servicio.",
          "19:00 - 21:00: Pre-carga de frío y revisión de checklists."
        ]
      },
      viernes: {
        title: "Viernes 18", badge: "Cierre Crítico",
        tasks: [
          "09:00 - 14:00: 2º viaje adelantado y descarga de menaje en Chera.",
          "15:00 - 21:00: Estiba, flejado y carga final en 3 camiones. Persona8 e Persona4 validan albaranes."
        ]
      }
    },
    saturdaySpecial: {
      title: "Sábado 19 — El Gran Día (3 Bodas Simultáneas)",
      weddings: [
        { location: "Lugar1 de Chera (250 pax)", truck: "Camión 1 (Gran Vol.)", details: "Conduce: Persona2 | Apoyo: Persona5. 🌙 Viaje nocturno de vuelta." },
        { location: "Mas dels Refranys", truck: "Camión 2 (Cliente3)", details: "Conduce: Persona1 | Apoyo: Persona3. ✅ Descarga hecha el miércoles." },
        { location: "Cliente15 y Cliente2", truck: "Camión 3 (Albacar)", details: "Conduce: Jaime (Guiado) | Apoyo: Persona3/Jef." }
      ]
    },
    sundayMonday: {
      title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
      tasks: [
        "Domingo (09:00 - 13:00): Descarga general de los 3 camiones en almacén. Limpieza de vajilla a cargo de Persona6 + Persona7 (o Persona5).",
        "Devoluciones: Devolución del Camión Albacar (Persona1/Persona2). Ruta a Empresa5 y 90 sillas a Carvillo el lunes."
      ]
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 antialiased p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold flex items-center gap-2.5">
              <Truck className="text-blue-400 w-6 h-6" /> Panel de Control Gula Logística
            </h1>
            <p className="text-xs text-slate-400 mt-1">{data.meta.week} | {data.meta.dateRange}</p>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> {data.meta.status}
          </div>
        </header>

        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="text-blue-600 w-4 h-4" /> Equipo y Estructura Operativa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {data.team.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700 block mb-0.5">{item.role}:</span>
                <span className="text-slate-600">{item.members}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Object.entries(data.schedule).map(([key, day]) => (
            <div key={key} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Calendar className="text-blue-600 w-4 h-4" /> {day.title}
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">{day.badge}</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                {day.tasks.map((task, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg">
                    <Clock className="text-slate-400 w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>{task}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <section className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Fire className="text-amber-400 w-5 h-5" /> {data.saturdaySpecial.title}
            </h3>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2.5 py-1 rounded-lg border border-amber-400/30">Día Clave</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {data.saturdaySpecial.weddings.map((w, idx) => (
              <div key={idx} className="bg-white/10 p-4 rounded-xl border border-white/10">
                <span className="font-bold text-amber-300 block mb-1">🏔️ {w.location}</span>
                <span className="text-slate-300 block mb-2">{w.truck}</span>
                <p className="text-[11px] text-slate-300">{w.details}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <Broom className="text-blue-600 w-4 h-4" /> {data.sundayMonday.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
            {data.sundayMonday.tasks.map((task, idx) => (
              <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {task}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
