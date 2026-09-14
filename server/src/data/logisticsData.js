// Seed content for week_3 — used only to bootstrap MongoDB the first time
// (or as an in-memory fallback if Mongo is offline). Once seeded, Mongo is
// the source of truth; editing this file afterwards has no effect on data
// that already exists in the database.
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
        { id: "m1a", text: "Recoger Sillas Carvillo — 90 sillas en jaula + jaula vacía.", location: "Carvillo", timeFrame: "", mapsUrl: "", assigned: ["Persona1"], completed: false },
        { id: "m1b", text: "Recoger Generador SOS.", location: "SOS", timeFrame: "", mapsUrl: "", assigned: ["Persona1"], completed: false },
        { id: "m1c", text: "Recoger Sofá Events & Style.", location: "Events & Style", timeFrame: "", mapsUrl: "", assigned: ["Persona1"], completed: false },
        { id: "m1d", text: "Recogida Camión Albacar (Persona2 y Persona3 — uno se trae el coche, otro el camión).", location: "Albacar Alquiler", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Albacar+Alquiler+Camiones+Valencia", assigned: ["Persona2", "Persona3"], completed: false },
        { id: "m2", text: "Preparación y organización de material para las 3 bodas del sábado (Persona4 y Persona8 dirigen checklist y preparan eventos, Persona5 ayuda).", location: "Almacén Base", timeFrame: "08:00 - 13:00", mapsUrl: "", assigned: ["Persona4", "Persona8", "Persona5"], completed: false },
        { id: "m3", text: "Carga de material de la boda de Cliente15 y Cliente2 en Camión Albacar — dejarlo todo listo (Persona2 + Persona3). Persona4 valida albaranes.", location: "Almacén Base", timeFrame: "13:00 - 17:00", mapsUrl: "", assigned: ["Persona2", "Persona3"], completed: false, truck: "Camión Albacar" },
        { id: "m4", text: "Recogida Empresa5 si es posible (1 persona: Persona2). Si no, se pasa al miércoles por la mañana.", location: "Empresa5 Paterna", timeFrame: "16:00 - 18:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empresa5+Paterna+Valencia", assigned: ["Persona2"], completed: false }
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Recogidas & Descarga Adelantada",
      tasks: [
        { id: "mi1", text: "(Backup) Recogida Empresa5 si no se hizo el martes — mañana temprano (1 persona: Persona2).", location: "Empresa5 Paterna", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empresa5+Paterna+Valencia", assigned: ["Persona2"], completed: false },
        { id: "mi2", text: "Viaje, descarga adelantada y montaje de estructura — Boda Cliente15 y Cliente2 (Conduce: Persona2 | Apoyo descarga y montaje: Persona5, Persona3 | Persona8 supervisa).", location: "", timeFrame: "15:00 - 20:00", mapsUrl: "", assigned: ["Persona2", "Persona5", "Persona3", "Persona8"], completed: false, truck: "Camión Albacar" },
        { id: "mi3", text: "Preparación y organización de material para los eventos Empresa1 y Empresa2 de mañana jueves (Persona4 dirige checklist).", location: "Almacén Base", timeFrame: "15:00 - 19:00", mapsUrl: "", assigned: ["Persona4"], completed: false },
        { id: "mi4", text: "Carga del material de los eventos Empresa1 y Empresa2 (preparado por Persona4) en dos camiones — un evento por camión (Persona1 y Jaime).", location: "Almacén Base", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Persona1", "Jaime"], completed: false }
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos Empresa1 & Empresa2",
      tasks: [
        { id: "j1", text: "Jornada Eventos: Catering Empresa1 (100 pax) — descarga y montaje de estructura en el lugar del evento (Conduce: Jaime | Apoyo descarga y montaje: Persona2, Persona3).", location: "Evento Empresa1", timeFrame: "11:15 - 13:00", mapsUrl: "", assigned: ["Jaime", "Persona2", "Persona3"], completed: false, truck: "Camión Gula" },
        { id: "j2", text: "Evento Empresa2 — logística completa, descarga y montaje de estructura (Conduce: Persona1 | Apoyo descarga y montaje: Persona5).", location: "Evento Empresa2", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Persona1", "Persona5"], completed: false, truck: "Camión Covey" },
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
