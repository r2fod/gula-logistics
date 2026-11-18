// Orden de las semanas para enseñarlas (selector del panel): por el número de su
// nombre («Semana 4»), de menor a mayor. Así, al poner o renumerar una semana, cada
// una queda en su sitio sin depender del orden en que llegan de la base. Las que no
// llevan número van al final, por nombre; con el mismo número manda el id.
// Devuelve [[id, semana]] nuevo: no toca el mapa de entrada.

const PATRON_NUMERO = /^Semana\s+(\d+)\b/i;
const nombreDe = (semana) => semana?.name || semana?.meta?.week || '';
const numeroDe = (semana) => {
  const cifra = PATRON_NUMERO.exec(nombreDe(semana))?.[1];
  return cifra === undefined ? null : BigInt(cifra);
};

export function semanasOrdenadas(semanas) {
  return Object.entries(semanas || {})
    .map(([id, semana]) => ({ id, semana, numero: numeroDe(semana) }))
    .sort((a, b) => {
      if (a.numero !== null && b.numero !== null && a.numero !== b.numero) return a.numero < b.numero ? -1 : 1;
      if ((a.numero === null) !== (b.numero === null)) return a.numero === null ? 1 : -1;
      return nombreDe(a.semana).localeCompare(nombreDe(b.semana)) || a.id.localeCompare(b.id);
    })
    .map(({ id, semana }) => [id, semana]);
}
