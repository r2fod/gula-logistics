import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import PremiumDialog from '../components/ui/PremiumDialog';

const DialogContext = createContext();
let ultimoId = 0;

export function DialogProvider({ children }) {
  // Cola de avisos: uno detrás de otro. Antes un segundo aviso sustituía al primero y la
  // promesa de este no se resolvía nunca (quien esperaba su respuesta se quedaba colgado).
  const [cola, setCola] = useState([]);

  const abrir = useCallback((aviso) => new Promise((resolve) => {
    const cerrar = (respuesta) => {
      setCola(prev => prev.filter(a => a !== aviso));
      resolve(respuesta);
    };
    aviso.id = ++ultimoId;
    aviso.onConfirm = () => cerrar(true);
    aviso.onCancel = () => cerrar(aviso.alCancelar);
    setCola(prev => [...prev, aviso]);
  }), []);

  const confirm = useCallback((message, options = {}) => abrir({
    message,
    title: options.title || 'Confirmación',
    type: options.type || 'confirm', // 'confirm', 'alert', 'error', 'warning', 'delete'
    confirmText: options.confirmText || 'Aceptar',
    cancelText: options.cancelText || 'Cancelar',
    alCancelar: false,
  }), [abrir]);

  // En un aviso, cerrarlo (Escape, X o el fondo) también cuenta como «entendido».
  const alert = useCallback((message, options = {}) => abrir({
    message,
    title: options.title || 'Aviso',
    type: options.type || 'alert',
    confirmText: options.confirmText || 'Entendido',
    alCancelar: true,
  }), [abrir]);

  const valor = useMemo(() => ({ confirm, alert }), [confirm, alert]);
  const actual = cola[0];

  return (
    <DialogContext.Provider value={valor}>
      {children}
      {actual && (
        // `key`: cada aviso de la cola monta el suyo (foco y Escape desde cero).
        <PremiumDialog key={actual.id} {...actual} />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog debe ser usado dentro de un DialogProvider');
  }
  return context;
}
