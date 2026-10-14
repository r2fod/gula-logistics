import { Selector } from '../ui/Campo';
import { camionesParaElegir } from '../../data/flota';

// El camión de una tarea del editor: los de la flota de la semana (ver data/flota.js).
export default function SelectorCamion({ valor = '', flota = [], onCambiar, acento }) {
  return (
    <Selector value={valor} onChange={(e) => onCambiar(e.target.value)} tamano="xs" acento={acento} texto="suave">
      <option value="">Sin camión / no aplica</option>
      {camionesParaElegir(flota, valor).map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
    </Selector>
  );
}
