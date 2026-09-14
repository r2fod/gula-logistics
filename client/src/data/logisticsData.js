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
    { role: "Dirección / Cocina / Ventas", members: "Anna y Cliente3" },
    { role: "Jefe Logística", members: "Persona8 (Supervisa y ayuda en base)" },
    { role: "Base & Preparación", members: "Persona4 (Pedidos/Checklist) + Persona5 (Apoyo Log/Prep)" },
    { role: "Flota / Conductores", members: "Persona1 & Persona2 (Veteranos) | Jaime (Guiado) | Persona3 (Backup)" },
    { role: "Limpieza & Vajilla Eventos", members: "Persona6 + Persona7 (Extra 10€/h)" }
  ],
  schedule: {
    martes: {
      title: "Martes 15", badge: "Arranque Flota",
      tasks: [
        "09:00 - 11:30: Recogida Camiones de Alquiler Covey & Albacar (Persona1 y Persona2). ¡Flota completa de 3!",
        "12:00 - 14:00: Ruta Carvillo — Recogida 90 sillas extra con Camión Gula.",
        "15:30 - 18:30: Ruta Empresa5 — Recogida material alquiler."
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Descarga Fincas",
      tasks: [
        "10:00 - 14:00: Pre-carga en almacén (Persona3 y Persona5).",
        "15:00 - 19:00: Descarga adelantada en Mas dels Refranys y Villajoyosa (Persona1, Persona2, Persona3) con Camión Covey."
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos",
      tasks: [
        "08:00 - 14:00: Catering Empresa1 (100 pax) - Anto, Marc, Luis.",
        "15:00 - 19:00: Evento Empresa2 - Control y servicio.",
        "19:00 - 21:00: Pre-carga de frío y revisión de checklists en Camión Gula."
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Cierre Crítico",
      tasks: [
        "09:00 - 14:00: 2º viaje adelantado y descarga de menaje en Chera con Camión Gula.",
        "15:00 - 21:00: Estiba, flejado y carga final en los 3 camiones (Camión Gula, Camión Covey, Camión Albacar). Persona8 e Persona4 validan albaranes."
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — El Gran Día (3 Bodas Simultáneas)",
    weddings: [
      { location: "Lugar1 de Chera (250 pax)", truck: "Camión Gula (Propio)", details: "Conduce: Persona2 | Apoyo: Persona5. 🌙 Viaje nocturno de vuelta." },
      { location: "Mas dels Refranys", truck: "Camión Covey (Alquiler)", details: "Conduce: Persona1 | Apoyo: Persona3. ✅ Descarga hecha el miércoles." },
      { location: "Cliente15 y Cliente2", truck: "Camión Albacar (Alquiler)", details: "Conduce: Jaime (Guiado) | Apoyo: Persona3/Jef." }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      "Domingo (09:00 - 13:00): Descarga general de los 3 camiones (Camión Gula, Camión Covey, Camión Albacar) en almacén. Limpieza de vajilla a cargo de Persona6 y Persona7 (o Persona5).",
      "Devoluciones: Devolución de Camiones de Alquiler Albacar y Covey (Persona1/Persona2). Ruta a Empresa5 y 90 sillas a Carvillo el lunes."
    ]
  }
};
