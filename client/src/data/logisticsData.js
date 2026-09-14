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
    { role: "Jefe Logística", members: "Persona8 (Supervisión general — NO carga ni descarga)" },
    { role: "Base & Preparación", members: "Persona4 (Prepara eventos / Verifica checklist — NO carga ni descarga) + Persona5 (Apoyo Log/Prep)" },
    { role: "Flota / Conductores", members: "Persona1 & Persona2 (Veteranos) | Jaime (Guiado) | Persona3 (Backup)" },
    { role: "Limpieza & Vajilla Eventos", members: "Persona6 + Persona7 (Extra 10€/h)" }
  ],
  schedule: {
    martes: {
      title: "Martes 15", badge: "Preparación & Carga",
      tasks: [
        { id: "m1", text: "Recogida Camión Albacar + Recoger Sofá Eventos — mañana pronto (1 persona: Persona1).", location: "Albacar Alquiler", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Albacar+Alquiler+Camiones+Valencia", assigned: ["Persona1"], completed: false },
        { id: "m2", text: "Preparación y organización de material para Eventos Empresa1 y Empresa2 (Persona4 dirige checklist, Persona5 ejecuta).", location: "Almacén Base", timeFrame: "08:00 - 13:00", mapsUrl: "", assigned: ["Persona4", "Persona5"], completed: false },
        { id: "m3", text: "Carga de eventos Empresa1 y Empresa2 en camiones — dejarlo todo listo (Persona5 + Persona3). Persona4 valida albaranes.", location: "Almacén Base", timeFrame: "13:00 - 17:00", mapsUrl: "", assigned: ["Persona5", "Persona3"], completed: false },
        { id: "m4", text: "Recogida Empresa5 si es posible (1 persona: Persona2). Si no, se pasa al miércoles por la mañana.", location: "Empresa5 Paterna", timeFrame: "16:00 - 18:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empresa5+Paterna+Valencia", assigned: ["Persona2"], completed: false }
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Recogidas & Descarga Adelantada",
      tasks: [
        { id: "mi1", text: "(Backup) Recogida Empresa5 si no se hizo el martes — mañana temprano (1 persona: Persona2).", location: "Empresa5 Paterna", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empresa5+Paterna+Valencia", assigned: ["Persona2"], completed: false },
        { id: "mi2", text: "Viaje, descarga adelantada y montaje de estructura en Villajoyosa (Conduce: Persona1 | Apoyo descarga y montaje: Persona3, Persona5).", location: "Villajoyosa", timeFrame: "15:00 - 20:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Villajoyosa", assigned: ["Persona1", "Persona3", "Persona5"], completed: false },
        { id: "mi3", text: "Cena prueba de menú — Cliente13 y Cliente14.", location: "", timeFrame: "20:00", mapsUrl: "", assigned: [], completed: false }
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos Empresa1 & Empresa2",
      tasks: [
        { id: "j1", text: "Jornada Eventos: Catering Empresa1 (100 pax) — descarga y montaje de estructura en lugar del evento (Conduce/Apoyo: Jaime, Persona3).", location: "Evento Empresa1", timeFrame: "09:00 - 18:00", mapsUrl: "", assigned: ["Jaime", "Persona3"], completed: false },
        { id: "j2", text: "Evento Empresa2 — logística completa, descarga y montaje estructura (Persona5).", location: "Evento Empresa2", timeFrame: "09:00 - 18:00", mapsUrl: "", assigned: ["Persona5"], completed: false },
        { id: "j3", text: "Regreso de eventos y pre-carga de frío para el fin de semana. Persona4 verifica checklist y prepara material. Persona8 supervisa.", location: "Almacén Base", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Persona4", "Persona8"], completed: false }
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Estiba Final & Cierre",
      tasks: [
        { id: "v1", text: "Descarga Refranys — recogida de material adelantado (Conduce Persona1 | Apoyo descarga: Persona3).", location: "Mas dels Refranys", timeFrame: "12:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys+Villajoyosa", assigned: ["Persona1", "Persona3"], completed: false },
        { id: "v1b", text: "Descarga Lugar1 de Chera — recogida de material adelantado (Conduce Persona2).", location: "Lugar1 de Chera", timeFrame: "15:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Lugar1+de+Chera+Valencia", assigned: ["Persona2"], completed: false },
        { id: "v1c", text: "Recoger Generador 7K + Recoger Fulanita.", location: "", timeFrame: "", mapsUrl: "", assigned: [], completed: false },
        { id: "v2", text: "Estiba, flejado y carga final de los 3 camiones para las bodas del sábado (Conductores: Persona1, Persona2, Jaime | Apoyo carga: Persona5, Persona3).", location: "Almacén Base", timeFrame: "15:00 - 21:00", mapsUrl: "", assigned: ["Persona1", "Persona2", "Jaime", "Persona5", "Persona3"], completed: false },
        { id: "v3", text: "Persona4 valida albaranes de salida y Persona8 supervisa la estiba y rutas.", location: "Almacén Base", timeFrame: "15:00 - 21:00", mapsUrl: "", assigned: ["Persona4", "Persona8"], completed: false }
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — DÍA COMPLETO (3 Bodas Simultáneas)",
    weddings: [
      { location: "Lugar1 de Chera (250 pax)", truck: "Camión Gula (Propio)", details: "Conduce: Persona2 | Apoyo descarga & montaje estructura: Persona5.", timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Lugar1+de+Chera+Valencia", assigned: ["Persona2", "Persona5"] },
      { location: "Cliente3 (Mas Dels Refranys)", truck: "Camión Covey (Alquiler)", details: "Conduce: Persona1 | Apoyo descarga & montaje estructura: Persona3.", timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys+Villajoyosa", assigned: ["Persona1", "Persona3"] },
      { location: "Cliente15 y Cliente2", truck: "Camión Albacar (Alquiler)", details: "Conduce: Jaime (Guiado) — descarga y montaje estructura en solitario. Persona7: Limpieza vajilla en evento.", timeFrame: "09:00 - 02:00", mapsUrl: "", assigned: ["Jaime"] }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      { id: "sl1", text: "Domingo — Regreso, descarga y desmontaje de estructura de los 3 eventos (Flota: Persona1, Persona2, Jaime | Apoyo descarga/desmontaje: Persona3, Persona5). Devolución Camión Albacar (Persona2 — 1 persona).", location: "Almacén Base", timeFrame: "09:00 - 14:00", mapsUrl: "", assigned: ["Persona1", "Persona2", "Jaime", "Persona3", "Persona5"], completed: false },
      { id: "sl2", text: "Lunes — Limpieza de vajilla y utensilios (Persona6 + Persona7). Persona4 verifica inventario. Devolución Camión Covey (Persona1 — 1 persona). Devoluciones material alquiler a Empresa5 (Persona3).", location: "Almacén Base / Empresa5", timeFrame: "09:00 - 15:00", mapsUrl: "", assigned: ["Persona6", "Persona7", "Persona4", "Persona1", "Persona3"], completed: false }
    ]
  }
};
