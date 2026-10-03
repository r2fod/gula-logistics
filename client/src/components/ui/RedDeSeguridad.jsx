import React from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

// Si un componente revienta al pintarse, React desmonta la app entera y solo queda el
// fondo oscuro (pasó con la ventana de «Fichar», 03/10). Esto lo recoge y enseña qué
// hacer: lo guardado no se pierde (está en el servidor y en el móvil), basta recargar.
export default class RedDeSeguridad extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fallo: null };
  }

  static getDerivedStateFromError(fallo) {
    return { fallo };
  }

  componentDidCatch(fallo, info) {
    console.error('La app ha fallado al pintarse:', fallo, info?.componentStack);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-center">
          <TriangleAlert className="mx-auto h-9 w-9 text-amber-400" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-extrabold">Algo ha fallado en esta pantalla</h1>
          <p className="mt-1.5 text-sm text-slate-400">No se ha perdido nada de lo guardado. Recarga la app para seguir.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
