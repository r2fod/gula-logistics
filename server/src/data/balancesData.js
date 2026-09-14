// Plantilla neutra usada SOLO como placeholder de carga / fallback offline.
// Los saldos y desgloses reales (importes, deudas, roturas, bolsas de horas)
// viven exclusivamente en MongoDB Atlas y se obtienen vía fetchBalancesFromAPI().
// No añadir aquí datos financieros reales: este archivo se publica en el bundle
// público del cliente (GitHub Pages).
export const initialBalancesData = {
  lastUpdated: "",
  workers: [
    { id: "gonzalo", name: "Gonzalo", role: "Conductor Flota (Veterano)", avatar: "🚛", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "ricardo", name: "Ricardo", role: "Conductor Flota (Veterano)", avatar: "🚚", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "jaime", name: "Jaime", role: "Conductor Flota (Guiado)", avatar: "🚛", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "johan", name: "Johan", role: "Conductor & Backup", avatar: "🚚", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "irene", name: "Irene", role: "Base & Checklist", avatar: "📦", status: "Nómina Fija", statusType: "payroll", hourlyRate: 14, currentBalance: 0, agreements: [], breakdown: [] },
    { id: "jeferson", name: "Jeferson", role: "Apoyo Logística & Prep", avatar: "📦", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "kerly", name: "Kerly", role: "Gula Limpieza Eventos", avatar: "🧹", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "jose", name: "Jose", role: "Gula Limpieza & Apoyo", avatar: "🧹", status: "Sin saldo", statusType: "neutral", currentBalance: 0, agreements: [], breakdown: [] },
    { id: "raul", name: "Raúl", role: "Jefe de Logística", avatar: "📋", status: "Nómina Fija", statusType: "payroll", hourlyRate: 14, currentBalance: 0, agreements: [], breakdown: [] }
  ]
};
