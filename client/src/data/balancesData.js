// Plantilla vacía — placeholder genérico sin datos reales de personal.
// Los saldos reales viven en MongoDB Atlas (server/src/routes/balances.routes.js)
// y se cargan vía fetchBalancesFromAPI(); esto solo se usa como estado inicial
// antes de que resuelva esa petición, o como fallback si el backend está caído.
export const initialBalancesData = {
  lastUpdated: '',
  workers: []
};
