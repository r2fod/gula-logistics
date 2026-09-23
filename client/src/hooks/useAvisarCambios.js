import { useState } from 'react';
import { sendPushNotification } from '../data/pushService';
import { useDialog } from '../contexts/DialogContext';

// Estado del aviso de cambios de planning: si el selector de a quién avisar está
// abierto y si hay un envío en curso. Lo comparten los botones de "Avisar Cambios"
// (que se desactivan mientras se envía) y el propio selector.
export function useAvisarCambios() {
  const { alert } = useDialog();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // `nombres` vacío = todos los trabajadores.
  const enviar = async (nombres) => {
    try {
      setEnviando(true);
      await sendPushNotification(
        '¡Nuevos turnos asignados!',
        'Revisa tu panel de trabajador, se han añadido o modificado tus turnos.',
        nombres
      );
      await alert(`Aviso enviado correctamente a ${nombres.length === 0 ? 'todos' : `${nombres.length} trabajador(es)`}.`, { type: 'success' });
      setAbierto(false);
    } catch {
      await alert('Hubo un error al enviar las notificaciones.', { type: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  return { abierto, abrir: () => setAbierto(true), cerrar: () => setAbierto(false), enviando, enviar };
}
