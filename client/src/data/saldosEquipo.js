import { coincideNombre } from './nombresTrabajadores';

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
// (aunque se llame "Persona2 Gula" y el equipo diga "Persona2") o una vacía.
// Sin esta unión, quien tiene saldo real salía con +0,00 € y sin desglose.
export function fusionarSaldosConEquipo(balancesData, workersList) {
  const fichas = balancesData?.workers || [];
  return {
    ...balancesData,
    workers: workersList.map((worker) => fichas.find((f) => coincideNombre(worker.name, f.name)) || fichaVacia(worker)),
  };
}

// `datosPorNombre` está indexado por el nombre corto del equipo ("Persona2");
// devuelve la entrada de la persona cuya ficha se llama `nombreSaldo`
// ("Persona2 Gula"), o null si no hay.
export function buscarPorNombreDeSaldo(datosPorNombre, nombreSaldo) {
  if (!nombreSaldo || !datosPorNombre) return null;
  const clave = Object.keys(datosPorNombre).find((nombreEquipo) => coincideNombre(nombreEquipo, nombreSaldo));
  return clave ? datosPorNombre[clave] : null;
}
