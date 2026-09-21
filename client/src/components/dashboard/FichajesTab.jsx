import React from 'react';
import { Lock, Eye, Plus, Clock, Edit3, Trash2 } from 'lucide-react';
import { fechaDeFichaje, horaDeFichaje } from '../../data/fichajes';
import Tarjeta from '../ui/Tarjeta';
import EstadoVacio from '../ui/EstadoVacio';

export default function FichajesTab({
  clockEntries,
  adminUnlocked,
  workersList,
  handleOpenCreateEntry,
  handleOpenEditEntry,
  onDeleteClockEntry
}) {
  return (
    <Tarjeta variante="panel" className="p-6 space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h3 className="text-xl font-extrabold text-white font-['Outfit']">
              Historial de Fichajes Registrados
            </h3>
            {adminUnlocked ? (
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-500 text-slate-950 rounded-full">
                CONTROL ADMINISTRATIVO
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3 text-blue-400" />
                <span>MODO SOLO LECTURA (SOCIAS)</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {adminUnlocked 
              ? 'Como Administrador autorizado, puedes editar la fecha/hora o eliminar fichajes.' 
              : 'Fichajes inmutables registrados por los trabajadores. Los datos están protegidos contra edición accidental.'}
          </p>
        </div>

        {adminUnlocked ? (
          <button
            onClick={handleOpenCreateEntry}
            className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Añadir Fichaje Manual (Admin)</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Fichajes Inmutables (Protegidos)</span>
          </span>
        )}
      </div>

      {clockEntries.length === 0 ? (
        <EstadoVacio
          icono={Clock}
          titulo="No hay fichajes registrados en el sistema."
          detalle="Los fichajes realizados por los trabajadores aparecerán aquí automáticamente."
          tituloDestacado
          className="py-12 bg-slate-950/60"
        />
      ) : (() => {
        const byDay = {};
        const sortedEntries = [...clockEntries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        sortedEntries.forEach(e => {
          const day = fechaDeFichaje(e) || 'Sin Fecha';
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(e);
        });

        const orderedDays = Object.keys(byDay).sort((a, b) => {
          const dateA = new Date(a.split('/').reverse().join('-'));
          const dateB = new Date(b.split('/').reverse().join('-'));
          return dateB - dateA; 
        });

        const groupedEntries = orderedDays.map(day => ({ name: day, entries: byDay[day] }));

        return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Fecha & Hora</th>
                <th className="py-3.5 px-4">Trabajador</th>
                <th className="py-3.5 px-4">Tipo</th>
                <th className="py-3.5 px-4">Tarea / Concepto</th>
                <th className="py-3.5 px-4">Tarifa (€/h)</th>
                <th className="py-3.5 px-4">Estado Seguridad</th>
                {adminUnlocked && <th className="py-3.5 px-4 text-center">Acciones Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {groupedEntries.map(({ name, entries }) => {
                return (
                  <React.Fragment key={name}>
                    <tr className="bg-slate-950/80">
                      <td colSpan={adminUnlocked ? 7 : 6} className="py-2 px-4">
                        <span className="inline-flex items-center gap-2 text-xs font-extrabold text-amber-300">
                          <span className="text-base">📅</span>
                          <span>{name}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                            {entries.length} {entries.length === 1 ? 'fichaje' : 'fichajes'}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {entries.map((entry) => {
                      const profile = workersList.find(w => w.name === entry.workerName);
                      return (
                <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-200">
                    <div className="font-bold text-white">
                      {horaDeFichaje(entry)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                          {fechaDeFichaje(entry)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{profile?.avatar || '👤'}</span>
                      <span className="font-bold text-slate-200">{entry.workerName || entry.worker || entry.name || 'Desconocido'}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {entry.type === 'entrada' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center space-x-1">
                        <span>🟢 ENTRADA</span>
                      </span>
                    ) : entry.type === 'fichaje' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 font-bold inline-flex items-center space-x-1">
                        <span>☑️ CHECK</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold inline-flex items-center space-x-1">
                        <span>🔴 SALIDA</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-medium">
                    {entry.taskName || entry.note || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                    {entry.rate || 10} €/h
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 inline-flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Registrado</span>
                    </span>
                  </td>
                  {adminUnlocked && (
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleOpenEditEntry(entry)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm('¿Estás seguro de que quieres borrar este fichaje?')) {
                              if (onDeleteClockEntry) onDeleteClockEntry(entry.id);
                            }
                          }}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                          title="Eliminar Fichaje (Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })()}
    </Tarjeta>
  );
}
