import React, { Suspense, useState } from 'react';
import Cargando from './Cargando';

// Para las ventanas que se bajan cuando hacen falta (React.lazy): no se montan —ni se
// descargan— hasta que se abren por primera vez, y después se quedan montadas para que
// conserven lo que tenían al cerrarlas (como cuando iban siempre con el panel).
// Mientras llega, un velo con «Cargando…».
export default function AlAbrir({ abierto, children }) {
  const [montada, setMontada] = useState(!!abierto);
  if (abierto && !montada) setMontada(true);
  if (!montada) return null;
  const velo = (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/85 animate-fadeIn">
      <Cargando className="" />
    </div>
  );
  return <Suspense fallback={abierto ? velo : null}>{children}</Suspense>;
}
