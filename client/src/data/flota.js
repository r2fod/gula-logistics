import { plano } from '../utils/texto';

// Un recado («recoger furgo por la tarde», «X recoger 105 sillas», «devolución generador»)
// no es un vehículo: un fallo antiguo del generador los metió en la flota y se copiaban
// de semana en semana. Se reconoce por la raíz del verbo, sin tildes.
const RECADO = /\b(recog|devolv|devoluc|llev|trae|traer|carg|descarg)\w*/;
export const esRecado = (nombre) => RECADO.test(plano(nombre));

// La flota sin recados (al crear una semana no se copian).
export const flotaSinRecados = (flota = []) => (flota || []).filter(t => !esRecado(t?.name));

// Los camiones que se pueden poner a una tarea: los de la flota de ESTA semana
// (Gestionar Flota, en Mongo) y, si la tarea ya lleva otro, también ese. Antes eran tres
// fijos con sus empresas de alquiler, escritos dos veces en el editor: un alquiler nuevo no
// salía y una tarea con otro camión se veía «Sin camión». Sin flota, ninguno. Los recados
// de la flota no se ofrecen (salvo el que la tarea ya lleva).
export function camionesParaElegir(flota = [], valor = '') {
  const deLaSemana = (flota || []).map(t => t?.name).filter(n => n && (n === valor || !esRecado(n)));
  return [...new Set([...deLaSemana, ...(valor ? [valor] : [])])];
}
