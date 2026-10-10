import { elMasParecido, fichaDePersona, mismoNombre, parecidoNombre } from './nombresTrabajadores';

// Ficha de Saldos de alguien del equipo que aún no tiene ninguna en Mongo.
const fichaVacia = (worker) => ({
  id: worker.name.toLowerCase().replace(/\s+/g, '-'),
  name: worker.name,
  role: worker.role,
  avatar: worker.avatar || '👤',
  status: 'Sin saldo',
  statusType: 'neutral',
  currentBalance: 0.0,
  agreements: [worker.isPayroll ? 'Nómina Fija (Control interno)' : 'Extra a 10,00 € / hora (Por Defecto)'],
  breakdown: [],
});

// Una ficha de Saldos por cada persona del equipo actual: la que ya existe
// (aunque se llame "Marta Gula" y el equipo diga "Marta") o una vacía.
// Sin esta unión, quien tiene saldo real salía con +0,00 € y sin desglose.
export function fusionarSaldosConEquipo(balancesData, workersList) {
  const fichas = balancesData?.workers || [];
  return {
    ...balancesData,
    workers: workersList.map((worker) => fichaDePersona(worker.name, fichas, workersList.map(w => w.name)) || fichaVacia(worker)),
  };
}

// `datosPorNombre` está indexado por el nombre corto del equipo ("Marta");
// devuelve la entrada de la persona cuya ficha se llama `nombreSaldo`
// ("Marta Gula"), o null si no hay.
export function buscarPorNombreDeSaldo(datosPorNombre, nombreSaldo) {
  if (!nombreSaldo || !datosPorNombre) return null;
  const clave = elMasParecido(Object.keys(datosPorNombre), (nombreEquipo) => parecidoNombre(nombreEquipo, nombreSaldo));
  return clave ? datosPorNombre[clave] : null;
}

// El turno abierto (entrada sin salida) de la persona del equipo de esta ficha, o null.
// La persona es la que MÁS se parece a la ficha: el turno de "Ana" sumaba en directo al
// saldo de "Mariana Gula" (su nombre contiene "ana").
export function turnoAbiertoDeFicha(turnosAbiertos = {}, ficha, equipo = []) {
  const persona = elMasParecido(equipo, (w) => parecidoNombre(w.name, ficha?.name))?.name || ficha?.name;
  return Object.values(turnosAbiertos || {}).find((e) => mismoNombre(e.workerName, persona)) || null;
}
