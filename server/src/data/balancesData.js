// Plantilla vacía — placeholder genérico sin datos reales de personal.
// Los saldos reales viven en la colección WorkerBalance de MongoDB Atlas;
// esto solo se usa como fallback en memoria si Mongo está caído o vacío
// (ver GET / y POST /seed en balances.routes.js).
export const initialBalancesData = {
  lastUpdated: '',
  workers: []
};
