import { useState, useCallback } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { datosDelPdf, nombreDelPdf } from '../data/pdfPlanning';

// Saca el planning de la semana en PDF y lo deja listo para la vista previa, donde se elige
// mandarlo por WhatsApp o descargarlo (VistaPreviaPdf). jsPDF solo se descarga al pulsar.
// → { generando, generar, pdf: { blob, nombre, texto } | null, cerrar }
export function usePdfPlanning(semana, equipo = []) {
  const { alert } = useDialog();
  const [generando, setGenerando] = useState(false);
  const [pdf, setPdf] = useState(null);

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
      const texto = `Planning ${modelo.cabecera.semana}${modelo.cabecera.rango ? ` (${modelo.cabecera.rango})` : ''}`;
      setPdf({ blob: pdfDelPlanning(modelo), nombre: nombreDelPdf(semana), texto });
    } catch (error) {
      await alert(`No se pudo generar el PDF: ${error?.message || 'error desconocido'}`, { type: 'error' });
    } finally {
      setGenerando(false);
    }
  }, [generando, semana, equipo, alert]);

  const cerrar = useCallback(() => setPdf(null), []);
  return { generando, generar, pdf, cerrar };
}
