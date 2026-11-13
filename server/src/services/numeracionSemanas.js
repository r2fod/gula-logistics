export const normalizarNombreSemana = (nombre) => {
  const limpio = nombre.trim();
  return /^\d+$/.test(limpio) ? `Semana ${BigInt(limpio)}` : limpio;
};

const patronNumero = /^(Semana\s+)(\d+)\b/i;
const numeroDe = (nombre) => {
  const cifra = nombre?.match(patronNumero)?.[2];
  return cifra === undefined ? null : BigInt(cifra);
};

// La semana elegida se queda con el número. El resto conserva su orden,
// incluidos los duplicados antiguos, hasta que haya hueco para todos.
export function cambiosDeNumeracion(semanas, weekId, nombre) {
  const cambios = [[weekId, nombre]];
  const pedido = numeroDe(nombre);
  if (pedido === null) return cambios;

  const ocupantes = semanas
    .filter(s => s.weekId !== weekId && !s.archivada)
    .map(({ weekId, name }) => ({ weekId, name, numero: numeroDe(name) }))
    .filter(s => s.numero !== null && s.numero >= pedido)
    .sort((a, b) => a.numero === b.numero ? a.weekId.localeCompare(b.weekId) : a.numero < b.numero ? -1 : 1);
  let libre = pedido + 1n;
  for (const s of ocupantes) {
    if (s.numero > libre - 1n) break;
    cambios.push([s.weekId, s.name.replace(patronNumero, (_, prefijo) => prefijo + libre)]);
    libre += 1n;
  }
  return cambios;
}

export function siguienteNumero(semanas) {
  const mayor = semanas.reduce((max, { name }) => {
    const numero = numeroDe(name);
    return numero !== null && numero > max ? numero : max;
  }, 0n);
  return `Semana ${mayor + 1n}`;
}
