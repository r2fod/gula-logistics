export const logisticsData = {
  meta: {
    week: "Semana 3",
    dateRange: "Del 15 al 20 de Septiembre de 2026",
    status: "Operativa Activa"
  },
  team: [
    { role: "Dirección / Cocina / Ventas", members: "Anna y Rocío" },
    { role: "Jefe Logística", members: "Raúl (Supervisa y ayuda en base)" },
    { role: "Base & Preparación", members: "Irene (Pedidos/Checklist) + Jeferson (Apoyo Log/Prep)" },
    { role: "Flota / Conductores", members: "Gonzalo & Ricardo (Veteranos) | Jaime (Guiado) | Johan (Backup)" },
    { role: "Limpieza & Vajilla Eventos", members: "Kerly + Jose (Extra 10€/h)" }
  ],
  schedule: {
    martes: {
      title: "Martes 15", badge: "Arranque Flota",
      tasks: [
        "09:00 - 11:30: Recogida Camión Albacar (Gonzalo y Ricardo). ¡Flota completa de 3!",
        "12:00 - 14:00: Ruta Carvillo — Recogida 90 sillas extra.",
        "15:30 - 18:30: Ruta Dealde — Recogida material alquiler."
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Descarga Fincas",
      tasks: [
        "10:00 - 14:00: Pre-carga en almacén (Johan y Jeferson).",
        "15:00 - 19:00: Descarga adelantada en Mas dels Refranys y Villajoyosa (Gonzalo, Ricardo, Johan)."
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos",
      tasks: [
        "08:00 - 14:00: Catering Encamina (100 pax) - Anto, Marc, Luis.",
        "15:00 - 19:00: Evento SUOT - Control y servicio.",
        "19:00 - 21:00: Pre-carga de frío y revisión de checklists."
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Cierre Crítico",
      tasks: [
        "09:00 - 14:00: 2º viaje adelantado y descarga de menaje en Chera.",
        "15:00 - 21:00: Estiba, flejado y carga final en 3 camiones. Raúl e Irene validan albaranes."
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — El Gran Día (3 Bodas Simultáneas)",
    weddings: [
      { location: "Sot de Chera (250 pax)", truck: "Camión 1 (Gran Vol.)", details: "Conduce: Ricardo | Apoyo: Jeferson. 🌙 Viaje nocturno de vuelta." },
      { location: "Mas dels Refranys", truck: "Camión 2 (Rocío)", details: "Conduce: Gonzalo | Apoyo: Johan. ✅ Descarga hecha el miércoles." },
      { location: "María y Joaquín", truck: "Camión 3 (Albacar)", details: "Conduce: Jaime (Guiado) | Apoyo: Johan/Jef." }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      "Domingo (09:00 - 13:00): Descarga general de 3 camiones en almacén. Limpieza de vajilla a cargo de Kerly y Jose (o Jeferson).",
      "Devoluciones: Devolución del Camión Albacar (Gonzalo/Ricardo). Ruta a Dealde y 90 sillas a Carvillo el lunes."
    ]
  }
};
