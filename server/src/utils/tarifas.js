// Tarifas por defecto del equipo (TeamRoster.tarifas): €/h de quien está fuera de nómina
// (`extra`) y en nómina (`nomina`) y ayuda de transporte por día (`transporte`). Las pone
// el admin y viven SOLO en la base: el código no lleva ninguna cifra (el repo es público).
const CLAVES_TARIFA = ['extra', 'nomina', 'transporte'];

// Solo esas tres claves, cada una un número entre 0 (sin incluir) y 100; lo demás se
// descarta y lo vacío se omite. `null` si no es un objeto o algún valor no es válido.
export function tarifasValidas(tarifas) {
  if (!tarifas || typeof tarifas !== 'object' || Array.isArray(tarifas)) return null;
  const limpias = {};
  for (const clave of CLAVES_TARIFA) {
    if (tarifas[clave] === undefined || tarifas[clave] === null || tarifas[clave] === '') continue;
    const valor = Number(tarifas[clave]);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) return null;
    limpias[clave] = valor;
  }
  return limpias;
}

// Las tarifas de un documento del equipo (o {} si no hay o no valen).
export const tarifasDelDocumento = (doc) => tarifasValidas(doc?.tarifas?.toObject ? doc.tarifas.toObject() : doc?.tarifas) || {};

// La tarifa por hora por defecto de alguien (según si está en nómina), o null si el admin
// no la ha puesto.
export const tarifaPorDefecto = (tarifas, enNomina) => {
  const valor = Number(tarifas?.[enNomina ? 'nomina' : 'extra']);
  return valor > 0 ? valor : null;
};
