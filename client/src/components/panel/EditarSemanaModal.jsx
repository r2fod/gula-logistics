import { useState } from 'react';
import { Pencil } from 'lucide-react';
import Boton from '../ui/Boton';
import CabeceraModal from '../ui/CabeceraModal';
import { Campo, Input } from '../ui/Campo';
import Modal from '../ui/Modal';

export default function EditarSemanaModal({ semana, onCerrar, onRenombrar, onEliminar }) {
  const [nombre, setNombre] = useState(semana.nombre);
  const [operacion, setOperacion] = useState(null);
  const [error, setError] = useState('');

  const ejecutar = async (accion, procesar, mensajeError) => {
    if (operacion) return;
    setOperacion(accion);
    setError('');
    try {
      const resultado = await procesar();
      if (resultado?.success) onCerrar();
      else if (!resultado?.cancelado) setError(resultado?.message || mensajeError);
    } catch {
      setError(mensajeError);
    } finally {
      setOperacion(null);
    }
  };

  const guardar = (evento) => {
    evento.preventDefault();
    if (!nombre.trim() || !onRenombrar) return;
    ejecutar('guardar', () => onRenombrar(semana.id, nombre.trim(), semana.updatedAt), 'No se pudo guardar el nombre de la semana.');
  };

  const eliminar = () => ejecutar(
    'eliminar',
    () => onEliminar(semana.id, semana.updatedAt, semana.nombre),
    'No se pudo eliminar la semana.',
  );

  return (
    <Modal onCerrar={onCerrar} botonCerrar={!operacion} cerrarConEscape={!operacion}>
      <CabeceraModal icono={Pencil} titulo="Editar semana" subtitulo={semana.fechas} className="mb-5" />
      <form className="space-y-4" onSubmit={guardar} aria-busy={!!operacion}>
        <Campo etiqueta="Nombre de la semana" ayuda="Si el número está ocupado, las semanas con ese número y los siguientes se desplazan hasta encontrar un número libre.">
          <Input maxLength={120} value={nombre} onChange={(evento) => setNombre(evento.target.value)} required disabled={!!operacion} />
        </Campo>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {onEliminar && <p className="text-xs text-slate-400">Al eliminar la semana, se retira del planning y se conserva su historial.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {onEliminar && (
            <Boton variante="fantasmaPeligro" onClick={eliminar} disabled={!!operacion} className="text-xs">
              {operacion === 'eliminar' ? 'Eliminando…' : 'Eliminar semana'}
            </Boton>
          )}
          <Boton tipo="submit" variante="primario" disabled={!!operacion || !nombre.trim() || !onRenombrar} className="text-xs">
            {operacion === 'guardar' ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
