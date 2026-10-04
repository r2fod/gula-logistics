import React, { useState } from 'react';
import { RefreshCw, Settings, ShieldCheck, ShieldOff } from 'lucide-react';
import { cerrarSesionesEnAPI } from '../data/apiService';
import { useDialog } from '../contexts/DialogContext';
import BaseDeDatos from './ajustes/BaseDeDatos';
import FicharConEnlace from './ajustes/FicharConEnlace';
import CambiarClave from './ajustes/CambiarClave';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';

// Configuración del admin, por orden de uso: el estado y la limpieza de la base de datos,
// fichar con el enlace personal y la seguridad (clave plegada y cerrar sesiones).
// Los datos (fichajes, papelera, equipo, semanas, fichas de Saldos) son los que la app ya
// tiene cargados; las acciones son las mismas que en Fichajes.
export default function AdminSettingsModal({
  isOpen, onClose, onIrAFichajes = null, onSesionesCerradas = null,
  fichajes = [], borrados = [], equipo = [], semanas = {}, fichas = [], onVaciarPapelera = null, onMoverAPapelera = null,
}) {
  const { alert, confirm } = useDialog();
  const [cerrando, setCerrando] = useState(false);
  if (!isOpen) return null;

  // Anula todo lo enviado antes (sesiones de admin y enlaces de socias, también los
  // viejos con la sesión de admin dentro) sin cambiar la clave. Los trabajadores, no.
  const cerrarSesiones = async () => {
    const ok = await confirm('Se cerrará la sesión de admin en los demás dispositivos y dejarán de valer TODOS los enlaces de socias enviados, también los antiguos. Tú sigues dentro y la clave no cambia. Los enlaces de los trabajadores siguen valiendo. Después, reenvía el enlace de socias nuevo.', { type: 'warning', title: 'Cerrar todas las sesiones', confirmText: 'Cerrar sesiones' });
    if (!ok) return;
    setCerrando(true);
    const r = await cerrarSesionesEnAPI();
    setCerrando(false);
    if (!r.ok) return alert(r.error, { type: 'error' });
    onSesionesCerradas?.();
    await alert('Hecho: sesiones y enlaces de socias anteriores anulados. Copia el enlace de socias nuevo («Link Socias») y reenvíalo.', { type: 'success' });
  };

  return (
    <Modal onCerrar={onClose} ancho="md" className="space-y-5">
      <CabeceraModal icono={Settings} tono="slate" titulo="Configuración" subtitulo="Panel de Ajustes de Administrador" />

      <BaseDeDatos
        fichajes={fichajes} borrados={borrados} equipo={equipo} semanas={semanas} fichas={fichas}
        onVaciarPapelera={onVaciarPapelera} onMoverAPapelera={onMoverAPapelera} onIrAFichajes={onIrAFichajes}
      />

      <FicharConEnlace fichajes={fichajes} />

      <section aria-labelledby="titulo-seguridad" className="space-y-3 border-t border-slate-800 pt-5">
        <h4 id="titulo-seguridad" className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Seguridad
        </h4>
        <CambiarClave onHecho={() => setTimeout(onClose, 2000)} />
        <div>
          <button
            type="button"
            onClick={cerrarSesiones}
            disabled={cerrando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-60"
          >
            {cerrando ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldOff className="h-4 w-4" aria-hidden="true" />}
            Cerrar todas las sesiones y enlaces de socias
          </button>
          <p className="mt-1.5 text-[11px] text-slate-400">Si un enlace de socias ha llegado a quien no debía o hay una sesión abierta en un móvil perdido: lo anula todo sin cambiar la clave.</p>
        </div>
      </section>
    </Modal>
  );
}
