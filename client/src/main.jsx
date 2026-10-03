import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { DialogProvider } from './contexts/DialogContext';
import RedDeSeguridad from './components/ui/RedDeSeguridad';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RedDeSeguridad>
      <DialogProvider>
        <App />
      </DialogProvider>
    </RedDeSeguridad>
  </React.StrictMode>
);

// Necesario para poder "instalar" la app (Chrome/Safari) y, más adelante,
// para los avisos push del navegador. No cachea nada del bundle — ver sw.js.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('No se pudo registrar el service worker:', err.message);
    });
  });
}

// El panel de admin se carga por partes (React.lazy en App.jsx). Si se despliega
// una versión nueva con la app ya abierta, los trozos viejos ya no existen: se
// recarga UNA vez para traer la versión nueva (si vuelve a fallar enseguida, no se
// insiste, para no entrar en un bucle de recargas).
window.addEventListener('vite:preloadError', (evento) => {
  const CLAVE = 'gula_recarga_por_version';
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) || 0);
    if (Date.now() - ultima < 60000) return;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch { /* sin sessionStorage: se recarga igual */ }
  evento.preventDefault();
  window.location.reload();
});
