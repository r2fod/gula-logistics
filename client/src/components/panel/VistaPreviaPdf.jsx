import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, MessageCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import CabeceraModal from '../ui/CabeceraModal';
import Boton from '../ui/Boton';
import { abrirEnPestanaNueva, compartirPorWhatsApp, descargarArchivo, esMovil } from '../../data/enlaces';

// Vista previa del planning en PDF con sus dos salidas: mandarlo por WhatsApp o descargarlo.
// `pdf`: { blob, nombre, texto } (usePdfPlanning) o null (cerrada).
export default function VistaPreviaPdf({ pdf, onCerrar }) {
  const url = useMemo(() => (pdf ? URL.createObjectURL(pdf.blob) : null), [pdf]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const [aviso, setAviso] = useState(null);

  if (!pdf) return null;
  const cerrar = () => { setAviso(null); onCerrar(); };
  const movil = esMovil();

  const porWhatsApp = async () => {
    const resultado = await compartirPorWhatsApp(pdf.blob, pdf.nombre, { titulo: pdf.nombre.replace(/\.pdf$/, ''), texto: pdf.texto });
    if (resultado === 'descargado') setAviso('Se ha descargado el PDF y se ha abierto WhatsApp: adjúntalo en el chat con el clip.');
  };

  return (
    <Modal onCerrar={cerrar} ancho="4xl" capa={60} disposicion="columna" botonCerrar={false}>
      <div className="shrink-0 border-b border-slate-800 p-4 sm:p-5">
        <CabeceraModal icono={FileText} tono="emerald" compacta titulo="Planning en PDF" subtitulo={pdf.nombre} acciones={null} />
      </div>
      <div className="min-h-0 flex-1 bg-slate-950 p-2 sm:p-3">
        {/* En el móvil el visor del navegador no siempre pinta un PDF dentro de la página: se abre aparte. */}
        {movil ? (
          <Boton onClick={() => abrirEnPestanaNueva(url)} className="w-full py-6 text-sm">
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver el PDF
          </Boton>
        ) : (
          <iframe src={url} title="Vista previa del planning" className="h-[60vh] w-full rounded-xl border border-slate-800 bg-white" />
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-slate-800 p-3 sm:p-4">
        {aviso && <p role="status" className="text-[11px] text-emerald-300">{aviso}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Boton onClick={porWhatsApp} className="bg-emerald-600 text-white hover:bg-emerald-500 border-0">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </Boton>
          <Boton onClick={() => descargarArchivo(pdf.blob, pdf.nombre)}>
            <Download className="h-4 w-4" aria-hidden="true" /> Descargar
          </Boton>
          <Boton onClick={cerrar}>Cerrar</Boton>
        </div>
      </div>
    </Modal>
  );
}
