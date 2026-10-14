// Los camiones que se pueden poner a una tarea: los de la flota de ESTA semana
// (Gestionar Flota, en Mongo) y, si la tarea ya lleva otro, también ese. Antes eran tres
// fijos con sus empresas de alquiler, escritos dos veces en el editor: un alquiler nuevo no
// salía y una tarea con otro camión se veía «Sin camión». Sin flota, ninguno.
export function camionesParaElegir(flota = [], valor = '') {
  const deLaSemana = (flota || []).map(t => t?.name).filter(Boolean);
  return [...new Set([...deLaSemana, ...(valor ? [valor] : [])])];
}
