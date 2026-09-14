import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Users, 
  Calendar, 
  Activity, 
  ShieldCheck, 
  Globe,
  Lock,
  Eye,
  LogOut,
  Sparkles,
  RefreshCw
} from 'lucide-react';

import LoginModal from './components/LoginModal';
import AdminPanel from './components/AdminPanel';
import PublicView from './components/PublicView';

const DEFAULT_DATA = {
  meta: {
    week: "Semana 3",
    dateRange: "Del 15 al 20 de Septiembre de 2026",
    status: "Operativa Activa"
  },
  team: [
    { role: "Jefe Logística", members: "Raúl (Supervisa)", category: "lead" },
    { role: "Base & Preparación", members: "Irene + Jeferson", category: "prep" },
    { role: "Flota", members: "Gonzalo, Ricardo, Jaime, Johan", category: "fleet" }
  ],
  trucks: [
    { name: "Camión Gula", status: "Activo / En Ruta", tag: "Principal" },
    { name: "Camión Covey", status: "Activo / En Ruta", tag: "Secundario" },
    { name: "Camión Albacar", status: "Activo / En Ruta", tag: "Apoyo" }
  ],
  tasks: [
    { id: '1', text: 'Revisión mecánica y niveles de aceite de Camión Gula', assignedTo: 'Camión Gula', priority: 'Alta', completed: true },
    { id: '2', text: 'Carga de cajas térmicas para catering de evento', assignedTo: 'Base & Preparación', priority: 'Alta', completed: false },
    { id: '3', text: 'Desinfección de cámara de Camión Covey', assignedTo: 'Camión Covey', priority: 'Media', completed: false }
  ]
};

const sanitizeData = (raw) => {
  if (!raw || typeof raw !== 'object') return DEFAULT_DATA;
  const cleanTeam = (raw.team || DEFAULT_DATA.team).filter(
    item => !item.role.toLowerCase().includes('cocina') && !item.role.toLowerCase().includes('dirección')
  );
  return {
    ...DEFAULT_DATA,
    ...raw,
    team: cleanTeam
  };
};

export default function App() {
  // Load initial data from localStorage or default with strict sanitization
  const [data, setData] = useState(() => {
    try {
      localStorage.removeItem('gula_logistics_data');
      localStorage.removeItem('gula_logistics_data_v2');
      const saved = localStorage.getItem('gula_logistics_v3_clean');
      return saved ? sanitizeData(JSON.parse(saved)) : DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('gula_is_admin') === 'true';
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync to localStorage
  const handleDataChange = (newData) => {
    const cleaned = sanitizeData(newData);
    setData(cleaned);
    try {
      localStorage.setItem('gula_logistics_v3_clean', JSON.stringify(cleaned));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
  };

  const handleToggleTask = (taskId) => {
    const updatedTasks = (data.tasks || []).map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    handleDataChange({ ...data, tasks: updatedTasks });
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    localStorage.setItem('gula_is_admin', 'true');
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('gula_is_admin');
  };

  // Optional sync with API endpoint if available
  const fetchLogisticsData = async () => {
    setLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.meta && json.team) {
          handleDataChange(json);
        }
      }
    } catch (err) {
      console.log('Usando datos persistentes en navegador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Header Navbar */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Outfit']">
                  Gula Logistics
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2.0 Live
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">Control Operativo & Flota de Camiones</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {isAdmin ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsAdmin(false)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Vista Pública</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir Admin</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Acceso Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {isAdmin ? (
          <AdminPanel
            data={data}
            onChangeData={handleDataChange}
            onLogout={handleLogout}
          />
        ) : (
          <PublicView
            data={data}
            onToggleTask={handleToggleTask}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Gula Logistics. Sistema de gestión operativa privada & pública.</p>
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

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
