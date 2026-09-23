import React, { createContext, useContext, useState, useCallback } from 'react';
import PremiumDialog from '../components/ui/PremiumDialog';

const DialogContext = createContext();

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialogState({
        message,
        title: options.title || 'Confirmación',
        type: options.type || 'confirm', // 'confirm', 'alert', 'error', 'warning'
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        onConfirm: () => {
          setDialogState(null);
          resolve(true);
        },
        onCancel: () => {
          setDialogState(null);
          resolve(false);
        }
      });
    });
  }, []);

  const alert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialogState({
        message,
        title: options.title || 'Aviso',
        type: options.type || 'alert',
        confirmText: options.confirmText || 'Entendido',
        onConfirm: () => {
          setDialogState(null);
          resolve(true);
        },
        onCancel: () => { // Optional cancel for alerts if they press Esc
          setDialogState(null);
          resolve(true);
        }
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialogState && (
        <PremiumDialog {...dialogState} />
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
