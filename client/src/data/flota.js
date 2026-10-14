// Sin flota guardada en la semana, los de siempre.
const CAMIONES_DE_SIEMPRE = ['Camión Gula', 'Camión Covey', 'Camión Albacar'];

// Los camiones que se pueden poner a una tarea: los de la flota de ESTA semana
// (Gestionar Flota) y, si la tarea ya lleva otro, también ese. Antes eran tres fijos,
// escritos dos veces en el editor: un alquiler nuevo no salía y una tarea con otro
// camión se veía «Sin camión».
export function camionesParaElegir(flota = [], valor = '') {
  const deLaSemana = (flota || []).map(t => t?.name).filter(Boolean);
  return [...new Set([...(deLaSemana.length ? deLaSemana : CAMIONES_DE_SIEMPRE), ...(valor ? [valor] : [])])];
}
