export const logisticsData = {
  meta: {
    week: "Semana 3",
    dateRange: "Del 15 al 20 de Septiembre de 2026",
    status: "Operativa Activa"
  },
  trucks: [
    { name: "Camión Gula", tag: "PROPIO GULA", status: "Operativo — Propiedad Gula Logística" },
    { name: "Camión Covey", tag: "ALQUILER COVEY", status: "Operativo — Alquiler Covey" },
    { name: "Camión Albacar", tag: "ALQUILER ALBACAR", status: "Operativo — Alquiler Albacar" }
  ],
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
        "09:00 - 11:30: Recogida Camiones de Alquiler Covey & Albacar (Gonzalo y Ricardo). ¡Flota completa de 3!",
        "12:00 - 14:00: Ruta Carvillo — Recogida 90 sillas extra con Camión Gula.",
        "15:30 - 18:30: Ruta Dealde — Recogida material alquiler.",
        "Preparación Eventos Boda María y Boda Rocío (Anna).",
        "Anto — Reunión/prep. SUOT.",
        "Marc — Prueba de menú.",
        "Miriam — Catering Encamina."
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Descarga Fincas",
      tasks: [
        "10:00 - 14:00: Pre-carga en almacén (Johan y Jeferson).",
        "15:00 - 19:00: Descarga adelantada en Mas dels Refranys y Villajoyosa (Gonzalo, Ricardo, Johan) con Camión Covey.",
        "20:00: Cena prueba de menú — Rita y Lluisen.",
        "Anto — Rita / SUOT.",
        "Marc — Boda Rita.",
        "Luis — Bodas."
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos",
      tasks: [
        "08:00 - 14:00: Catering Encamina (100 pax) - Anto, Marc, Luis.",
        "15:00 - 19:00: Evento SUOT - Control y servicio.",
        "19:00 - 21:00: Pre-carga de frío y revisión de checklists en Camión Gula.",
        "Jessi — Bodas."
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Cierre Crítico — Día Completo",
      tasks: [
        "09:00 - 14:00: 2º viaje adelantado y descarga de menaje en Chera con Camión Gula.",
        "Descarga en Villajoyosa / Mas dels Refranys (continuación).",
        "15:00 - 21:00: Estiba, flejado y carga final en los 3 camiones (Camión Gula, Camión Covey, Camión Albacar). Raúl e Irene validan albaranes.",
        "Anto, Marc, Jessi — Bodas (prep. final)."
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — El Gran Día (3 Bodas Simultáneas)",
    weddings: [
      { location: "Sot de Chera (250 pax)", truck: "Camión Gula (Propio)", details: "Conduce: Ricardo | Apoyo: Jeferson. Sala/evento: Marc. 🌙 Viaje nocturno de vuelta." },
      { location: "Mas dels Refranys — Boda Rocío", truck: "Camión Covey (Alquiler)", details: "Conduce: Gonzalo | Apoyo: Johan. Sala/evento: Anto. ✅ Descarga hecha el miércoles/viernes." },
      { location: "María y Joaquín", truck: "Camión Albacar (Alquiler)", details: "Conduce: Jaime (Guiado) | Apoyo: Johan/Jef." }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      "Domingo (09:00 - 13:00): Descarga general de los 3 camiones (Camión Gula, Camión Covey, Camión Albacar) en almacén. Limpieza de vajilla a cargo de Kerly y Jose (o Jeferson).",
      "Devoluciones: Devolución de Camiones de Alquiler Albacar y Covey (Gonzalo/Ricardo). Ruta a Dealde y 90 sillas a Carvillo el lunes."
    ]
  }
};
