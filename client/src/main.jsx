import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
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
