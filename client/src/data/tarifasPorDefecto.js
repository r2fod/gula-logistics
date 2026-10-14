import { formatearCantidad } from './formatoFinanciero';

// Tarifas por defecto del equipo: €/h de quien no está en nómina (`extra`) y de quien sí
// (`nomina`), y la ayuda de transporte por día (`transporte`). Las pone el admin y viven
// SOLO en Mongo (TeamRoster.tarifas, vía /api/roster): el código no lleva ninguna cifra
// (el repo es público). Sin dato no se inventa: vale null y la app lo avisa.
//
// Se cargan una vez (useWorkers) y se leen desde cualquier sitio, como los festivos locales.
let actuales = { extra: null, nomina: null, transporte: null };
const oyentes = new Set();

const valida = (n) => (Number(n) > 0 ? Number(n) : null);

export const tarifasPorDefecto = () => actuales;

export function usarTarifasPorDefecto(tarifas = {}) {
  actuales = { extra: valida(tarifas?.extra), nomina: valida(tarifas?.nomina), transporte: valida(tarifas?.transporte) };
  oyentes.forEach(oyente => oyente());
}

export function alCambiarTarifasPorDefecto(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// La tarifa por hora por defecto de alguien (según si está en nómina), o null.
export const tarifaPorDefecto = (enNomina) => actuales[enNomina ? 'nomina' : 'extra'];

// La ayuda de transporte por día, o null si el admin no la ha puesto.
export const transporteDia = () => actuales.transporte;

// Lo que cobra por hora alguien del equipo (o un fichaje, que lleva `rate` e `isPayroll`):
// lo de su ficha o, si no tiene, lo por defecto de la base. 0 si no hay ninguna: nunca una
// cifra puesta en el código.
export const tarifaDe = (persona) => Number(persona?.rate) || tarifaPorDefecto(persona?.isPayroll) || 0;

// Su tarifa para una etiqueta: «12€/h», «12,5€/h»; «sin tarifa» si no hay ninguna.
export const tarifaCorta = (persona) => (tarifaDe(persona) > 0 ? `${formatearCantidad(tarifaDe(persona))}€/h` : 'sin tarifa');

// Quién no tiene tarifa: ni la suya ni la por defecto de su tipo.
export const sinTarifa = (equipo = []) => equipo.filter(w => !(tarifaDe(w) > 0));
