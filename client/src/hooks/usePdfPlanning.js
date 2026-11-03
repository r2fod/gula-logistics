import { useState, useCallback } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { datosDelPdf, nombreDelPdf } from '../data/pdfPlanning';
import { compartirArchivo } from '../data/enlaces';

// Saca el planning de la semana en PDF y lo comparte (en el móvil sale WhatsApp; si no se
// puede, lo descarga). jsPDF solo se descarga al pulsar. → { generando, generar }
export function usePdfPlanning(semana, equipo = []) {
  const { alert } = useDialog();
  const [generando, setGenerando] = useState(false);

  const generar = useCallback(async () => {
    if (generando) return;
    const modelo = datosDelPdf(semana, equipo);
    if (!modelo.totalTareas) {
      await alert('Esta semana no tiene tareas: no hay nada que sacar en PDF.', { type: 'info' });
      return;
    }
    setGenerando(true);
    try {
      const { pdfDelPlanning } = await import('../data/pdfPlanningDoc');
      const nombre = nombreDelPdf(semana);
      await compartirArchivo(pdfDelPlanning(modelo), nombre, { titulo: nombre.replace(/\.pdf$/, ''), texto: `Planning ${modelo.cabecera.semana}${modelo.cabecera.rango ? ` (${modelo.cabecera.rango})` : ''}` });
    } catch (error) {
      await alert(`No se pudo generar el PDF: ${error?.message || 'error desconocido'}`, { type: 'error' });
    } finally {
      setGenerando(false);
    }
  }, [generando, semana, equipo, alert]);

  return { generando, generar };
}
