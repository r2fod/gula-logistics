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
    { role: "Dirección / Cocina / Ventas", members: "Anna y Rocío" },
    { role: "Jefe Logística", members: "Raúl (Supervisión general — NO carga ni descarga)" },
    { role: "Base & Preparación", members: "Irene (Prepara eventos / Verifica checklist — NO carga ni descarga) + Jeferson (Apoyo Log/Prep)" },
    { role: "Flota / Conductores", members: "Gonzalo & Ricardo (Veteranos) | Jaime (Guiado) | Johan (Backup)" },
    { role: "Limpieza & Vajilla Eventos", members: "Kerly + Jose (Extra 10€/h)" }
  ],
  schedule: {
    martes: {
      title: "Martes 15", badge: "Preparación & Carga",
      tasks: [
        { id: "m1a", text: "Recoger Sillas Carvillo — 90 sillas en jaula + jaula vacía.", location: "Carvillo", timeFrame: "", mapsUrl: "", assigned: ["Gonzalo"], completed: false },
        { id: "m1b", text: "Recoger Generador SOS.", location: "SOS", timeFrame: "", mapsUrl: "", assigned: ["Gonzalo"], completed: false },
        { id: "m1c", text: "Recoger Sofá Events & Style.", location: "Events & Style", timeFrame: "", mapsUrl: "", assigned: ["Gonzalo"], completed: false },
        { id: "m1d", text: "Recogida Camión Albacar (Ricardo y Johan — uno se trae el coche, otro el camión).", location: "Albacar Alquiler", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Albacar+Alquiler+Camiones+Valencia", assigned: ["Ricardo", "Johan"], completed: false },
        { id: "m2", text: "Preparación y organización de material para las 3 bodas del sábado (Irene y Raúl dirigen checklist y preparan eventos, Jeferson ayuda).", location: "Almacén Base", timeFrame: "08:00 - 13:00", mapsUrl: "", assigned: ["Irene", "Raúl", "Jeferson"], completed: false },
        { id: "m3", text: "Carga de material de la boda de María y Joaquín en Camión Albacar — dejarlo todo listo (Ricardo + Johan). Irene valida albaranes.", location: "Almacén Base", timeFrame: "13:00 - 17:00", mapsUrl: "", assigned: ["Ricardo", "Johan"], completed: false, truck: "Camión Albacar" },
        { id: "m4", text: "Recogida Dealde si es posible (1 persona: Ricardo). Si no, se pasa al miércoles por la mañana.", location: "Dealde Paterna", timeFrame: "16:00 - 18:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dealde+Paterna+Valencia", assigned: ["Ricardo"], completed: false }
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Recogidas & Descarga Adelantada",
      tasks: [
        { id: "mi1", text: "(Backup) Recogida Dealde si no se hizo el martes — mañana temprano (1 persona: Ricardo).", location: "Dealde Paterna", timeFrame: "08:00 - 10:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Dealde+Paterna+Valencia", assigned: ["Ricardo"], completed: false },
        { id: "mi2", text: "Viaje, descarga adelantada y montaje de estructura — Boda María y Joaquín (Conduce: Ricardo | Apoyo descarga y montaje: Jeferson, Johan | Raúl supervisa).", location: "", timeFrame: "15:00 - 20:00", mapsUrl: "", assigned: ["Ricardo", "Jeferson", "Johan", "Raúl"], completed: false, truck: "Camión Albacar" },
        { id: "mi3", text: "Preparación y organización de material para los eventos Encamina y SUOT de mañana jueves (Irene dirige checklist).", location: "Almacén Base", timeFrame: "15:00 - 19:00", mapsUrl: "", assigned: ["Irene"], completed: false },
        { id: "mi4", text: "Carga del material de los eventos Encamina y SUOT (preparado por Irene) en dos camiones — un evento por camión (Gonzalo y Jaime).", location: "Almacén Base", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Gonzalo", "Jaime"], completed: false }
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos Encamina & SUOT",
      tasks: [
        { id: "j1", text: "Jornada Eventos: Catering Encamina (100 pax) — descarga y montaje de estructura en el lugar del evento (Conduce: Jaime | Apoyo descarga y montaje: Ricardo, Johan).", location: "Evento Encamina", timeFrame: "11:15 - 13:00", mapsUrl: "", assigned: ["Jaime", "Ricardo", "Johan"], completed: false, truck: "Camión Gula" },
        { id: "j2", text: "Evento SUOT — logística completa, descarga y montaje de estructura (Conduce: Gonzalo | Apoyo descarga y montaje: Jeferson).", location: "Evento SUOT", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Gonzalo", "Jeferson"], completed: false, truck: "Camión Covey" },
        { id: "j3", text: "Regreso de eventos y pre-carga de frío para el fin de semana. Irene verifica checklist y prepara material. Raúl supervisa.", location: "Almacén Base", timeFrame: "19:00 - 21:00", mapsUrl: "", assigned: ["Irene", "Raúl"], completed: false }
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Estiba Final & Cierre",
      tasks: [
        { id: "v1", text: "Descarga Refranys — recogida de material adelantado (Conduce Gonzalo | Apoyo descarga: Johan).", location: "Mas dels Refranys", timeFrame: "12:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys+Villajoyosa", assigned: ["Gonzalo", "Johan"], completed: false },
        { id: "v1b", text: "Descarga Sot de Chera — recogida de material adelantado (Conduce Ricardo).", location: "Sot de Chera", timeFrame: "15:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sot+de+Chera+Valencia", assigned: ["Ricardo"], completed: false },
        { id: "v1c", text: "Recoger Generador 7K + Recoger Fulanita.", location: "", timeFrame: "", mapsUrl: "", assigned: [], completed: false },
        { id: "v2", text: "Estiba, flejado y carga final de los 3 camiones para las bodas del sábado (Conductores: Gonzalo, Ricardo, Jaime | Apoyo carga: Jeferson, Johan).", location: "Almacén Base", timeFrame: "15:00 - 21:00", mapsUrl: "", assigned: ["Gonzalo", "Ricardo", "Jaime", "Jeferson", "Johan"], completed: false },
        { id: "v3", text: "Irene valida albaranes de salida y Raúl supervisa la estiba y rutas.", location: "Almacén Base", timeFrame: "15:00 - 21:00", mapsUrl: "", assigned: ["Irene", "Raúl"], completed: false }
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — DÍA COMPLETO (3 Bodas Simultáneas)",
    weddings: [
      { location: "Sot de Chera (250 pax)", truck: "Camión Gula (Propio)", details: "Conduce: Ricardo | Apoyo descarga & montaje estructura: Jeferson.", timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sot+de+Chera+Valencia", assigned: ["Ricardo", "Jeferson"] },
      { location: "Rocío (Mas Dels Refranys)", truck: "Camión Covey (Alquiler)", details: "Conduce: Gonzalo | Apoyo descarga & montaje estructura: Johan.", timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys+Villajoyosa", assigned: ["Gonzalo", "Johan"] },
      { location: "María y Joaquín", truck: "Camión Albacar (Alquiler)", details: "Conduce: Jaime (Guiado) — descarga y montaje estructura en solitario. Jose: Limpieza vajilla en evento.", timeFrame: "09:00 - 02:00", mapsUrl: "", assigned: ["Jaime"] }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      { id: "sl1", text: "Domingo — Regreso, descarga y desmontaje de estructura de los 3 eventos (Flota: Gonzalo, Ricardo, Jaime | Apoyo descarga/desmontaje: Johan, Jeferson). Devolución Camión Albacar (Ricardo — 1 persona).", location: "Almacén Base", timeFrame: "09:00 - 14:00", mapsUrl: "", assigned: ["Gonzalo", "Ricardo", "Jaime", "Johan", "Jeferson"], completed: false },
      { id: "sl2", text: "Lunes — Limpieza de vajilla y utensilios (Kerly + Jose). Irene verifica inventario. Devolución Camión Covey (Gonzalo — 1 persona). Devoluciones material alquiler a Dealde (Johan).", location: "Almacén Base / Dealde", timeFrame: "09:00 - 15:00", mapsUrl: "", assigned: ["Kerly", "Jose", "Irene", "Gonzalo", "Johan"], completed: false }
    ]
  }
};
