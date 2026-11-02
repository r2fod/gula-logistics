// Props para una tarjeta que se marca o desmarca con un clic o con Enter/Espacio (un `div`
// que hace de botón). `marcar` null = solo lectura: sin rol ni foco.
export const alMarcar = (marcar, hecha) => (marcar ? {
  role: 'button', tabIndex: 0, 'aria-pressed': hecha, onClick: marcar,
  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); marcar(); } },
} : {});
