// Texto para comparar (nombres de personas): sin tildes, en minúsculas y sin espacios
// a los lados. «Sofía» y «sofia » son lo mismo.
export const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
