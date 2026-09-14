import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Users, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  ShieldCheck, 
  ChefHat, 
  Navigation, 
  Search, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  Server, 
  Globe,
  MapPin,
  PackageCheck,
  AlertCircle
} from 'lucide-react';

const FALLBACK_DATA = {
  meta: {
    week: "Semana 3",
    dateRange: "Del 15 al 20 de Septiembre de 2026",
    status: "Operativa Activa"
  },
  team: [
    { role: "Jefe Logística", members: "Raúl (Supervisa)", category: "lead", icon: ShieldCheck, count: 1 },
    { role: "Base & Preparación", members: "Irene + Jeferson", category: "prep", icon: PackageCheck, count: 2 },
    { role: "Flota", members: "Gonzalo, Ricardo, Jaime, Johan", category: "fleet", icon: Truck, count: 4 }
  ]
};

export default function App() {
  const [data, setData] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('static'); // 'api' | 'static'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const fetchLogisticsData = async () => {
    setLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/logistics';
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.meta && json.team) {
          setData(json);
          setDataSource('api');
        }
      } else {
        setDataSource('static');
      }
    } catch (err) {
      console.log('Modo autónomo activado: Usando datos en cliente');
      setDataSource('static');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
  }, []);

  // Filter team members based on search
  const filteredTeam = (data.team || FALLBACK_DATA.team).filter(item => {
    const matchesSearch = item.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.members.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && item.category === activeTab;
  });

  const totalPersonnel = (data.team || FALLBACK_DATA.team).reduce((acc, curr) => {
    const membersList = curr.members.split(/,|\+|\sy\s/).filter(Boolean);
    return acc + (curr.count || membersList.length);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Glow Effects Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Truck className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-['Outfit']">
                  Gula Logistics
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.0 Live
                </span>
              </div>
              <p className="text-xs text-slate-400">Control & Planificación Operativa de Entregas</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status indicator pill */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              {dataSource === 'api' ? (
                <>
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Conectado a Backend API</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>GitHub Pages Standalone</span>
                </>
              )}
            </div>

            <button 
              onClick={fetchLogisticsData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              title="Sincronizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Banner Status Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-slate-950/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{data.meta?.week || "Semana Actual"}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Planificación Operativa de Logística
              </h2>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                <div className="flex items-center space-x-2 bg-slate-950/60 px-3.5 py-1.5 rounded-xl border border-slate-800">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>{data.meta?.dateRange}</span>
                </div>
                <div className="flex items-center space-x-2 bg-emerald-950/30 px-3.5 py-1.5 rounded-xl border border-emerald-800/40 text-emerald-300">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-medium">{data.meta?.status}</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-800 lg:pl-6">
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80">
                <p className="text-xs font-medium text-slate-400">Personal Activo</p>
                <p className="text-2xl font-bold text-amber-400 mt-1 font-['Outfit']">{totalPersonnel} personas</p>
              </div>
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80">
                <p className="text-xs font-medium text-slate-400">Conductores Flota</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1 font-['Outfit']">4 vehículos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Header & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-xl font-bold text-white tracking-tight">
              Equipo & Roles Asignados
            </h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
              {filteredTeam.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por rol o miembro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-all"
            />
          </div>
        </div>

        {/* Team Grid Cards */}
        {filteredTeam.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-slate-800/60">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No se encontraron roles ni miembros con esa búsqueda</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredTeam.map((item, idx) => {
              const IconComp = item.icon || Users;
              return (
                <div 
                  key={idx}
                  className="group relative rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-colors">
                        <IconComp className="w-5 h-5 text-amber-400" />
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
                        {item.role.includes("Flota") ? "4 Miembros" : item.role.includes("Dirección") ? "2 Miembros" : item.role.includes("Base") ? "2 Miembros" : "1 Supervisión"}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                        {item.role}
                      </h4>
                      <p className="text-sm text-slate-300 mt-2 font-medium leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                        {item.members}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Turno Confirmado</span>
                    </span>
                    <span className="text-slate-500">Gula Ops</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Informational Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex space-x-4 items-start">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-white text-base">Horarios & Turnos</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Coordinación directa de turnos de preparación y franja de salida de vehículos de flota.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex space-x-4 items-start">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-white text-base">Rutas & Entregas</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Optimización de itinerarios para eventos y entregas semanales registradas.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex space-x-4 items-start">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-white text-base">Seguridad de Datos</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Código estático desplegado en GitHub Pages con almacenamiento seguro de datos MongoDB.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Gula Logistics. Sistema de gestión operativa pública.</p>
          <div className="flex items-center space-x-4">
            <a 
              href="https://github.com/r2fod/gula-logistics" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-slate-300 transition-colors flex items-center space-x-1"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
