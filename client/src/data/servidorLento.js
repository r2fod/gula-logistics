// ¿El servidor está tardando en contestar? En el plan gratuito, Render lo duerme tras
// 15 min sin uso y tarda 30–50 s en despertar: mientras, la app parecía colgada. Se
// cuentan las peticiones que pasan de AVISO_LENTO_MS sin respuesta y se avisa a quien
// escuche (AvisoServidorLento) para que lo diga en pantalla.
export const AVISO_LENTO_MS = 6000;

let lentas = 0;
const oyentes = new Set();
const avisar = () => oyentes.forEach((oyente) => oyente(lentas > 0));

// Sigue una petición (su promesa) y la devuelve tal cual.
export function seguirPeticion(promesa) {
  let lenta = false;
  const reloj = setTimeout(() => {
    lenta = true;
    lentas += 1;
    avisar();
  }, AVISO_LENTO_MS);
  const terminar = () => {
    clearTimeout(reloj);
    if (lenta) {
      lentas -= 1;
      avisar();
    }
  };
  promesa.then(terminar, terminar);
  return promesa;
}

// oyente(hayLentas) ahora y en cada cambio. Devuelve la función para dejar de escuchar.
export function escucharServidorLento(oyente) {
  oyentes.add(oyente);
  oyente(lentas > 0);
  return () => oyentes.delete(oyente);
}
