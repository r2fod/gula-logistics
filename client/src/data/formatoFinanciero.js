// Formato de importes, horas y porcentajes del Resumen Financiero, a la
// española: coma decimal y punto de millares ("2.025,00 €"). Se hace a mano y no
// con Intl porque el español no agrupa los miles de 4 cifras ("2025,00") y así el
// resultado no depende del navegador.

const agrupar = (entero) => entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// 1234.5 -> "1.234,50". Un negativo que se redondea a cero no lleva signo.
export function formatearNumero(n, decimales = 2) {
  const valor = Number.isFinite(n) ? n : 0;
  const [entero, decimal] = Math.abs(valor).toFixed(decimales).split('.');
  const esCero = Number(`${entero}.${decimal || 0}`) === 0;
  return `${valor < 0 && !esCero ? '-' : ''}${agrupar(entero)}${decimal ? `,${decimal}` : ''}`;
}

export const formatearEuros = (n) => `${formatearNumero(n, 2)} €`;

// Cantidad sin ceros de sobra y sin unidad: 3,5 · 242,5 · 12 · 0,75. Es la base
// de las horas y de cualquier cifra que no sea dinero.
export function formatearCantidad(n) {
  const valor = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  const [entero, decimal] = String(Math.abs(valor)).split('.');
  return `${valor < 0 ? '-' : ''}${agrupar(entero)}${decimal ? `,${decimal}` : ''}`;
}

// Horas: 3,5 h · 242,5 h · 12 h · 0,75 h.
export const formatearHoras = (n) => `${formatearCantidad(n)} h`;

// Importe con su signo explícito para los saldos: +125,50 € · -30,00 €. Cero lleva "+".
export const formatearEurosConSigno = (n) => `${n >= 0 ? '+' : ''}${formatearEuros(n)}`;

export const formatearPorcentaje = (n, decimales = 1) => `${formatearNumero(n, decimales)} %`;
