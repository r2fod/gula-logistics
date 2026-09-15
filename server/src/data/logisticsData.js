// Seed content para bootstrapear MongoDB la primera vez (o como fallback en
// memoria si Mongo está offline). Una vez sembrado, Mongo es la fuente de
// verdad — editar este archivo después no afecta a datos que ya existen en
// la base de datos. Plantilla esqueleto genérica: sin clientes, bodas ni
// eventos reales.
export const logisticsData = {
  meta: {
    week: "Semana de ejemplo",
    dateRange: "Sin datos cargados todavía",
    status: "Esperando datos del servidor"
  },
  trucks: [
    { name: "Camión 1", tag: "PROPIO", status: "Operativo" },
    { name: "Camión 2", tag: "ALQUILER", status: "Operativo" },
    { name: "Camión 3", tag: "ALQUILER", status: "Operativo" }
  ],
  team: [
    { role: "Dirección", members: "" },
    { role: "Jefe Logística", members: "" },
    { role: "Base & Preparación", members: "" },
    { role: "Flota / Conductores", members: "" },
    { role: "Limpieza & Vajilla Eventos", members: "" }
  ],
  schedule: {
    martes: {
      title: "Martes", badge: "Preparación & Carga",
      tasks: [
        { id: "m1", text: "Tarea de ejemplo — recogida de material.", location: "", timeFrame: "", phone: "", mapsUrl: "", assigned: [], completed: false }
      ]
    },
    miercoles: {
      title: "Miércoles", badge: "Recogidas & Descarga Adelantada",
      tasks: [
        { id: "mi1", text: "Tarea de ejemplo — descarga adelantada.", location: "", timeFrame: "", phone: "", mapsUrl: "", assigned: [], completed: false }
      ]
    },
    jueves: {
      title: "Jueves", badge: "Eventos",
      tasks: [
        { id: "j1", text: "Tarea de ejemplo — evento.", location: "", timeFrame: "", phone: "", mapsUrl: "", assigned: [], completed: false }
      ]
    },
    viernes: {
      title: "Viernes", badge: "Estiba Final & Cierre",
      tasks: [
        { id: "v1", text: "Tarea de ejemplo — estiba final.", location: "", timeFrame: "", phone: "", mapsUrl: "", assigned: [], completed: false }
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado — Eventos Simultáneos",
    weddings: [
      { location: "Evento de ejemplo", truck: "Camión 1", details: "", timeFrame: "", mapsUrl: "", phone: "", assigned: [] }
    ]
  },
  sundayMonday: {
    title: "Domingo & Lunes — Logística Inversa y Limpieza",
    tasks: [
      { id: "sl1", text: "Tarea de ejemplo — logística inversa.", location: "", timeFrame: "", phone: "", mapsUrl: "", assigned: [], completed: false }
    ]
  }
};
