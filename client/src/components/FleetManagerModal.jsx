import React, { useState } from 'react';
import { Plus, Trash2, Upload, FileText, Truck, AlertCircle } from 'lucide-react';
import { uploadRentalPdf } from '../data/apiService';
import Modal from './ui/Modal';
import BotonCerrar from './ui/BotonCerrar';
import { Input, Selector } from './ui/Campo';
import { useDialog } from '../contexts/DialogContext';

export default function FleetManagerModal({ isOpen, onClose, activeWeekData, onUpdateWeek }) {
  const { confirm } = useDialog();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  if (!isOpen || !activeWeekData) return null;

  const trucks = activeWeekData.trucks || [];

  const handleAddTruck = () => {
    const newTruck = {
      name: "Nuevo Camión",
      tag: "PROPIO",
      status: "Operativo"
    };
    onUpdateWeek(activeWeekData.id, { trucks: [...trucks, newTruck] });
  };

  const handleUpdateTruck = (idx, field, value) => {
    const newTrucks = [...trucks];
    newTrucks[idx] = { ...newTrucks[idx], [field]: value };
    onUpdateWeek(activeWeekData.id, { trucks: newTrucks });
  };

  const handleDeleteTruck = async (idx) => {
    if (await confirm("¿Estás seguro de eliminar este camión?", { type: 'warning' })) {
      const newTrucks = trucks.filter((_, i) => i !== idx);
      onUpdateWeek(activeWeekData.id, { trucks: newTrucks });
    }
  };

  const handleFileUpload = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      const res = await uploadRentalPdf(file);
      if (res.success) {
        handleUpdateTruck(idx, 'pdfUrl', res.url);
      }
    } catch (err) {
      setUploadError("Error al subir el archivo PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <Modal onCerrar={onClose} ancho="4xl" capa={100} disposicion="columna" botonCerrar={false}>
      <div className="flex justify-between items-center p-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            Gestión de Flota ({trucks.length})
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configura camiones propios y de alquiler (con tareas de recogida/devolución automáticas).</p>
        </div>
        <BotonCerrar onClick={onClose} />
      </div>

      <div className="p-6 overflow-y-auto flex-1 space-y-4">
        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {uploadError}
          </div>
        )}

        {trucks.map((truck, idx) => (
          <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 relative group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nombre / Matrícula</label>
                  <Input
                    type="text"
                    value={truck.name}
                    onChange={(e) => handleUpdateTruck(idx, 'name', e.target.value)}
                    redondeo="lg" fondo="medio" borde="marcado"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
                  <Selector
                    value={truck.tag || 'PROPIO'}
                    onChange={(e) => handleUpdateTruck(idx, 'tag', e.target.value)}
                    redondeo="lg" fondo="medio" borde="marcado"
                  >
                    <option value="PROPIO">PROPIO</option>
                    <option value="ALQUILER">ALQUILER</option>
                  </Selector>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteTruck(idx)}
                className="ml-4 p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {truck.tag === 'ALQUILER' && (
              <div className="mt-4 pt-4 border-t border-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-amber-500 flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5" />
                    Programación Automática (Recogida y Devolución)
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={truck.isContinuousRental || false}
                      onChange={(e) => handleUpdateTruck(idx, 'isContinuousRental', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900/50 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 transition-colors"
                    />
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                      Alquiler Continuo (Larga Duración)
                    </span>
                  </label>
                </div>
                
                {truck.isContinuousRental ? (
                  <div className="mb-4 space-y-4">
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>El vehículo está en alquiler continuo. No se generarán tareas semanales repetitivas de recogida y devolución.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fecha de inicio</label>
                        <Input
                          type="date"
                          value={truck.continuousStart || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'continuousStart', e.target.value)}
                          redondeo="lg" fondo="medio" borde="marcado"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fecha de fin</label>
                        <Input
                          type="date"
                          value={truck.continuousEnd || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'continuousEnd', e.target.value)}
                          redondeo="lg" fondo="medio" borde="marcado"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  <div className="space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                    <div className="text-xs font-medium text-emerald-400">Datos de Recogida</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Día</label>
                        <Selector
                          value={truck.pickupDay || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'pickupDay', e.target.value)}
                          tamano="2xs" redondeo="lg" fondo="medio" borde="marcado"
                        >
                          <option value="">-- Día --</option>
                          {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                        </Selector>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Hora (Ej: 10:00)</label>
                        <Input
                          type="time"
                          value={truck.pickupTime || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'pickupTime', e.target.value)}
                          tamano="2xs" redondeo="lg" fondo="medio" borde="marcado"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                    <div className="text-xs font-medium text-rose-400">Datos de Devolución</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Día</label>
                        <Selector
                          value={truck.returnDay || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'returnDay', e.target.value)}
                          tamano="2xs" redondeo="lg" fondo="medio" borde="marcado"
                        >
                          <option value="">-- Día --</option>
                          {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                        </Selector>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Hora límite</label>
                        <Input
                          type="time"
                          value={truck.returnTime || ''}
                          onChange={(e) => handleUpdateTruck(idx, 'returnTime', e.target.value)}
                          tamano="2xs" redondeo="lg" fondo="medio" borde="marcado"
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Contrato / Resguardo (PDF)</label>
                  <div className="flex items-center gap-3">
                    {truck.pdfUrl ? (
                      <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg flex-1">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-slate-300 truncate font-mono">
                          {truck.pdfUrl.split('/').pop()}
                        </span>
                        <button 
                          onClick={() => handleUpdateTruck(idx, 'pdfUrl', '')}
                          className="ml-auto text-red-400 hover:text-red-300 text-xs"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex-1">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => handleFileUpload(idx, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isUploading}
                        />
                        <div className={`flex items-center justify-center gap-2 border border-dashed border-slate-700 bg-slate-900/50 rounded-lg px-3 py-2 text-xs text-slate-400 transition-colors ${isUploading ? 'opacity-50' : 'hover:border-amber-500 hover:text-amber-400'}`}>
                          <Upload className="w-4 h-4" />
                          {isUploading ? 'Subiendo...' : 'Subir PDF del alquiler'}
                        </div>
                      </div>
                    )}
                    
                    {truck.pdfUrl && (
                      <a 
                        href={truck.pdfUrl}
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg border border-slate-700 whitespace-nowrap"
                      >
                        Ver Documento
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={handleAddTruck}
          className="w-full flex justify-center items-center gap-2 py-4 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Añadir Camión
        </button>
      </div>
    </Modal>
  );
}
