import { useAhora } from '../../hooks/useAhora';

// Lo único que se vuelve a pintar cada `cadaMs` (por defecto, cada segundo): un
// cronómetro, el dinero que va subiendo… Así la pantalla entera no se redibuja
// cada segundo solo para mover un número.
//   <EnVivo>{(ahora) => duracionEnCurso(entrada, ahora)}</EnVivo>
export default function EnVivo({ cadaMs = 1000, children }) {
  const ahora = useAhora(cadaMs);
  return children(ahora);
}
