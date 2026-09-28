// Texto para comparar: sin tildes, en minúsculas y con los espacios normalizados.
// Una sola versión: antes había una copia en cada módulo que comparaba textos.
export const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
